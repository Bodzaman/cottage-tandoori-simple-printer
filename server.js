const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

console.log('🖨️  Cottage Tandoori Windows Printer Helper v2.0.0');
console.log('🔧 Using Windows print spooler (no thermal drivers needed)');
console.log(`🚀 Server starting on port ${PORT}...`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        version: '2.0.0',
        method: 'Windows Print Spooler',
        printer: 'EPSON TM-T20III'
    });
});

// Helper function to create print-ready text for thermal receipt
function formatReceipt(data, type = 'receipt') {
    let receipt = '';

    if (type === 'kitchen') {
        receipt += 'COTTAGE TANDOORI - KITCHEN\n';
        receipt += '================================\n';
        receipt += `Order #${data.orderNumber || 'N/A'}\n`;
        receipt += `Table: ${data.table || 'Takeaway'}\n`;
        receipt += `Time: ${new Date().toLocaleString()}\n`;
        receipt += '--------------------------------\n';

        if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
                receipt += `${item.quantity || 1}x ${item.name || 'Item'}\n`;
                if (item.modifiers && item.modifiers.length > 0) {
                    item.modifiers.forEach(mod => {
                        receipt += `  + ${mod}\n`;
                    });
                }
                if (item.specialInstructions) {
                    receipt += `  NOTE: ${item.specialInstructions}\n`;
                }
                receipt += '\n';
            });
        }

        receipt += '--------------------------------\n';
        receipt += 'Special Instructions:\n';
        receipt += `${data.notes || data.specialInstructions || 'None'}\n`;
        receipt += '================================\n';

    } else {
        // Customer receipt
        receipt += 'COTTAGE TANDOORI\n';
        receipt += '123 Restaurant Street\n';
        receipt += 'Phone: (555) 123-4567\n';
        receipt += '================================\n';
        receipt += `Order #${data.orderNumber || 'N/A'}\n`;
        receipt += `${new Date().toLocaleString()}\n`;
        receipt += '--------------------------------\n';

        if (data.items && Array.isArray(data.items)) {
            let subtotal = 0;
            data.items.forEach(item => {
                const price = parseFloat(item.price || 0);
                const quantity = parseInt(item.quantity || 1);
                const itemTotal = price * quantity;
                subtotal += itemTotal;

                receipt += `${quantity}x ${item.name || 'Item'}`;
                receipt += ` £${itemTotal.toFixed(2)}\n`;
            });

            receipt += '--------------------------------\n';
            receipt += `Subtotal: £${subtotal.toFixed(2)}\n`;
            if (data.tax) {
                receipt += `Tax: £${parseFloat(data.tax).toFixed(2)}\n`;
            }
            if (data.deliveryFee) {
                receipt += `Delivery: £${parseFloat(data.deliveryFee).toFixed(2)}\n`;
            }

            const total = subtotal + parseFloat(data.tax || 0) + parseFloat(data.deliveryFee || 0);
            receipt += `TOTAL: £${total.toFixed(2)}\n`;
        }

        receipt += '================================\n';
        receipt += 'Thank you for your order!\n';
        receipt += 'Visit us again soon!\n';
    }

    return receipt;
}

// Helper function to print using Windows print spooler
function printToWindows(content, callback) {
    const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);

    try {
        // Write content to temp file
        fs.writeFileSync(tempFile, content, 'utf8');

        // Use PowerShell to send to printer via Windows spooler
        const printCmd = `powershell -Command "try { Get-Content '${tempFile}' | Out-Printer -Name 'EPSON TM-T20III'; Write-Output 'SUCCESS' } catch { Write-Output 'ERROR: ' + $_.Exception.Message }"`;

        exec(printCmd, (error, stdout, stderr) => {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.log('Could not delete temp file:', e.message);
            }

            if (error) {
                console.error('❌ Print command error:', error.message);
                callback(error, null);
            } else if (stdout.includes('ERROR:')) {
                const errorMsg = stdout.replace('ERROR: ', '').trim();
                console.error('❌ PowerShell print error:', errorMsg);
                callback(new Error(errorMsg), null);
            } else {
                console.log('✅ Print sent to Windows spooler successfully');
                callback(null, 'Print job sent to EPSON TM-T20III');
            }
        });

    } catch (writeError) {
        console.error('❌ File write error:', writeError.message);
        callback(writeError, null);
    }
}

// Kitchen ticket endpoint
app.post('/print/kitchen', (req, res) => {
    console.log('📝 Kitchen ticket print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = formatReceipt(req.body, 'kitchen');
        console.log('📄 Formatted kitchen ticket:', receiptText);

        printToWindows(receiptText, (error, result) => {
            if (error) {
                console.error('❌ Kitchen print failed:', error.message);
                res.status(500).json({
                    success: false,
                    message: 'Kitchen print failed',
                    error: error.message,
                    method: 'Windows Print Spooler'
                });
            } else {
                console.log('✅ Kitchen ticket printed successfully');
                res.json({
                    success: true,
                    message: 'Kitchen ticket printed successfully',
                    method: 'Windows Print Spooler',
                    printer: 'EPSON TM-T20III'
                });
            }
        });

    } catch (error) {
        console.error('❌ Kitchen format error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to format kitchen ticket',
            error: error.message
        });
    }
});

// Customer receipt endpoint
app.post('/print/receipt', (req, res) => {
    console.log('🧾 Customer receipt print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = formatReceipt(req.body, 'receipt');
        console.log('📄 Formatted customer receipt:', receiptText);

        printToWindows(receiptText, (error, result) => {
            if (error) {
                console.error('❌ Receipt print failed:', error.message);
                res.status(500).json({
                    success: false,
                    message: 'Receipt print failed',
                    error: error.message,
                    method: 'Windows Print Spooler'
                });
            } else {
                console.log('✅ Customer receipt printed successfully');
                res.json({
                    success: true,
                    message: 'Receipt printed successfully',
                    method: 'Windows Print Spooler',
                    printer: 'EPSON TM-T20III'
                });
            }
        });

    } catch (error) {
        console.error('❌ Receipt format error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to format receipt',
            error: error.message
        });
    }
});

// Test print endpoint
app.post('/print/test', (req, res) => {
    console.log('🧪 Test print request received');

    const testContent = 'COTTAGE TANDOORI - TEST PRINT\n' +
                       '================================\n' +
                       'Windows Print Spooler Test\n' +
                       `Time: ${new Date().toLocaleString()}\n` +
                       'Printer: EPSON TM-T20III\n' +
                       'Method: Windows Print Spooler\n' +
                       'Status: Helper app working!\n' +
                       '================================\n' +
                       'If you can read this, the\n' +
                       'Windows-first approach works!\n';

    printToWindows(testContent, (error, result) => {
        if (error) {
            console.error('❌ Test print failed:', error.message);
            res.status(500).json({
                success: false,
                message: 'Test print failed',
                error: error.message,
                method: 'Windows Print Spooler'
            });
        } else {
            console.log('✅ Test print sent successfully');
            res.json({
                success: true,
                message: 'Test print sent successfully',
                method: 'Windows Print Spooler',
                printer: 'EPSON TM-T20III'
            });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🖨️  Ready to print via Windows spooler to EPSON TM-T20III`);
    console.log(`🧪 Test: POST http://localhost:${PORT}/print/test`);
    console.log(`📝 Kitchen: POST http://localhost:${PORT}/print/kitchen`);
    console.log(`🧾 Receipt: POST http://localhost:${PORT}/print/receipt`);
    console.log(`💡 No thermal drivers needed - leverages Windows print system!`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Windows printer helper...');
    process.exit(0);
});

module.exports = app;