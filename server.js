const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Printer detection function
function detectPrinters() {
    return new Promise((resolve) => {
        const printers = [];

        // Try to detect Windows printers
        const wmic = spawn('wmic', ['printer', 'get', 'name,status'], { shell: true });
        let output = '';

        wmic.stdout.on('data', (data) => {
            output += data.toString();
        });

        wmic.on('close', (code) => {
            if (code === 0) {
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.includes('TM-T20III') || line.includes('TM-T88V')) {
                        printers.push({
                            name: line.trim(),
                            status: 'detected',
                            type: line.includes('TM-T20III') ? 'kitchen' : 'receipt'
                        });
                    }
                }
            }

            // Add fallback printers if none detected
            if (printers.length === 0) {
                printers.push(
                    { name: 'TM-T20III (Kitchen)', status: 'not_detected', type: 'kitchen' },
                    { name: 'TM-T88V (Receipt)', status: 'not_detected', type: 'receipt' }
                );
            }

            resolve(printers);
        });

        wmic.on('error', () => {
            // Fallback if WMIC fails
            resolve([
                { name: 'TM-T20III (Kitchen)', status: 'fallback_mode', type: 'kitchen' },
                { name: 'TM-T88V (Receipt)', status: 'fallback_mode', type: 'receipt' }
            ]);
        });
    });
}

// Print function using Windows print system
function printToWindows(printerName, content) {
    return new Promise((resolve) => {
        log(`Attempting to print to: ${printerName}`);

        // Create temporary file
        const tempFile = path.join(__dirname, 'temp_print.txt');
        fs.writeFileSync(tempFile, content);

        // Use Windows print command
        const printProcess = spawn('print', ['/D:' + printerName, tempFile], { shell: true });

        printProcess.on('close', (code) => {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }

            if (code === 0) {
                log(`Print successful to ${printerName}`);
                resolve({ success: true, message: 'Print completed successfully' });
            } else {
                log(`Print failed to ${printerName}, code: ${code}`);
                resolve({ success: false, message: `Print failed with code ${code}` });
            }
        });

        printProcess.on('error', (error) => {
            log(`Print error: ${error.message}`);
            resolve({ success: false, message: error.message });
        });
    });
}

// Routes
app.get('/health', async (req, res) => {
    log('Health check requested');

    try {
        const printers = await detectPrinters();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            port: PORT,
            printers: printers,
            endpoints: [
                'GET /health',
                'POST /print/kitchen',
                'POST /print/receipt', 
                'POST /print/test',
                'GET /printers'
            ]
        });
    } catch (error) {
        log(`Health check error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/printers', async (req, res) => {
    log('Printer list requested');

    try {
        const printers = await detectPrinters();
        res.json({ printers });
    } catch (error) {
        log(`Printer detection error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/print/kitchen', async (req, res) => {
    log('Kitchen print requested');

    try {
        const { order, items } = req.body;

        // Generate kitchen ticket content
        let content = '\n=== KITCHEN TICKET ===\n';
        content += `Order: ${order || 'N/A'}\n`;
        content += `Time: ${new Date().toLocaleString()}\n`;
        content += '----------------------\n';

        if (items && Array.isArray(items)) {
            items.forEach((item, index) => {
                content += `${index + 1}. ${item.name} x${item.quantity}\n`;
                if (item.notes) content += `   Notes: ${item.notes}\n`;
            });
        } else {
            content += 'TEST KITCHEN PRINT\n';
        }

        content += '======================\n\n';

        const result = await printToWindows('TM-T20III', content);

        res.json({
            success: result.success,
            message: result.message,
            printer: 'TM-T20III (Kitchen)',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Kitchen print error: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/print/receipt', async (req, res) => {
    log('Receipt print requested');

    try {
        const { order, customer, total, items } = req.body;

        // Generate receipt content
        let content = '\n=== COTTAGE TANDOORI ===\n';
        content += `Order: ${order || 'N/A'}\n`;
        content += `Customer: ${customer || 'N/A'}\n`;
        content += `Time: ${new Date().toLocaleString()}\n`;
        content += '-------------------------\n';

        if (items && Array.isArray(items)) {
            items.forEach(item => {
                content += `${item.name} x${item.quantity} - £${item.price}\n`;
            });
        } else {
            content += 'TEST RECEIPT PRINT\n';
        }

        content += '-------------------------\n';
        content += `TOTAL: £${total || '0.00'}\n`;
        content += '\nThank you for your order!\n\n';

        const result = await printToWindows('TM-T88V', content);

        res.json({
            success: result.success,
            message: result.message,
            printer: 'TM-T88V (Receipt)',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Receipt print error: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/print/test', async (req, res) => {
    log('Test print requested');

    try {
        const { printer } = req.body;
        const printerName = printer === 'kitchen' ? 'TM-T20III' : 'TM-T88V';

        const content = `\n=== TEST PRINT ===\n` +
                       `Printer: ${printerName}\n` +
                       `Time: ${new Date().toLocaleString()}\n` +
                       `Status: Working correctly\n` +
                       `==================\n\n`;

        const result = await printToWindows(printerName, content);

        res.json({
            success: result.success,
            message: result.message,
            printer: printerName,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Test print error: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    log(`🚀 Cottage Tandoori Thermal Printer Helper`);
    log(`📡 Server running on http://localhost:${PORT}`);
    log(`🖨️  Ready for TM-T20III & TM-T88V printing`);
    log(`\n📋 Available endpoints:`);
    log(`   GET  /health       - Health check`);
    log(`   GET  /printers     - List printers`);
    log(`   POST /print/kitchen - Kitchen tickets`);
    log(`   POST /print/receipt - Customer receipts`);
    log(`   POST /print/test   - Test printing`);
    log(`\n✅ Ready for POSII integration!`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('\n🛑 Shutting down Thermal Printer Helper...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('\n🛑 Shutting down Thermal Printer Helper...');
    process.exit(0);
});
