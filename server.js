const express = require('express');
const cors = require('cors');
const os = require('os');
const { exec } = require('child_process');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
const PORT = 3001;

// Printer configuration
const KITCHEN_PRINTER_NAME = "EPSON TM-T20III Receipt";

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize thermal printer
function initializePrinter() {
    try {
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: 'printer:' + KITCHEN_PRINTER_NAME,
            options: {
                timeout: 5000
            }
        });
        return printer;
    } catch (error) {
        console.error('Printer initialization error:', error.message);
        return null;
    }
}

// Format kitchen ticket
function formatKitchenTicket(orderData) {
    const printer = initializePrinter();
    if (!printer) {
        throw new Error('Failed to initialize printer');
    }

    try {
        // Header
        printer.alignCenter();
        printer.setTextSize(1, 1);
        printer.bold(true);
        printer.println("COTTAGE TANDOORI");
        printer.println("KITCHEN ORDER");
        printer.bold(false);
        printer.drawLine();

        // Order details
        printer.alignLeft();
        printer.setTextNormal();
        printer.println(`Order: ${orderData.orderNumber || 'N/A'}`);
        printer.println(`Type: ${orderData.orderType || 'DINE-IN'}`);
        printer.println(`Time: ${new Date().toLocaleTimeString()}`);

        if (orderData.table) {
            printer.println(`Table: ${orderData.table}`);
        }

        printer.drawLine();

        // Items
        printer.bold(true);
        printer.println("ITEMS:");
        printer.bold(false);

        if (orderData.items && Array.isArray(orderData.items)) {
            orderData.items.forEach((item, index) => {
                printer.println(`${index + 1}. ${item.name}`);
                if (item.quantity > 1) {
                    printer.println(`   Qty: ${item.quantity}`);
                }
                if (item.modifiers && item.modifiers.length > 0) {
                    item.modifiers.forEach(mod => {
                        printer.println(`   * ${mod}`);
                    });
                }
                if (item.notes) {
                    printer.println(`   Notes: ${item.notes}`);
                }
                printer.println('');
            });
        }

        // Special instructions
        if (orderData.specialInstructions) {
            printer.drawLine();
            printer.bold(true);
            printer.println("SPECIAL INSTRUCTIONS:");
            printer.bold(false);
            printer.println(orderData.specialInstructions);
        }

        // Footer
        printer.drawLine();
        printer.alignCenter();
        printer.println("*** KITCHEN COPY ***");
        printer.cut();

        return printer;
    } catch (error) {
        console.error('Error formatting kitchen ticket:', error.message);
        throw error;
    }
}

// Windows printer fallback
function printToWindowsPrinter(content, printerName) {
    return new Promise((resolve, reject) => {
        // Create a simple text file for printing
        const printContent = `
COTTAGE TANDOORI - KITCHEN ORDER
================================
${content}
================================
*** KITCHEN COPY ***
        `;

        // Use Windows print command
        const command = `echo "${printContent.replace(/"/g, '\"')}" | print /D:"${printerName}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Windows print error:', error.message);
                reject(error);
            } else {
                console.log('Windows print success:', stdout);
                resolve(stdout);
            }
        });
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        nodeVersion: process.version,
        port: PORT,
        printerName: KITCHEN_PRINTER_NAME
    });
});

// Kitchen printer
app.post('/print/kitchen', async (req, res) => {
    try {
        const orderData = req.body;
        console.log('Kitchen print request:', JSON.stringify(orderData, null, 2));

        if (!orderData.items || !Array.isArray(orderData.items)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid order data: items array required' 
            });
        }

        console.log(`Printing to kitchen printer: ${KITCHEN_PRINTER_NAME}...`);

        try {
            // Try thermal printer first
            const printer = formatKitchenTicket(orderData);
            const isConnected = await printer.isPrinterConnected();

            if (isConnected) {
                await printer.execute();
                console.log('✅ Thermal print successful');

                res.json({
                    success: true,
                    message: 'Kitchen ticket printed successfully via thermal printer',
                    printer: KITCHEN_PRINTER_NAME,
                    method: 'thermal',
                    timestamp: new Date().toISOString(),
                    itemCount: orderData.items.length
                });
            } else {
                throw new Error('Thermal printer not connected');
            }
        } catch (thermalError) {
            console.log('Thermal printer failed, trying Windows print...');

            // Fallback to Windows printer
            const printContent = orderData.items.map((item, i) => 
                `${i+1}. ${item.name} ${item.quantity > 1 ? `(x${item.quantity})` : ''}`
            ).join('\n');

            await printToWindowsPrinter(printContent, KITCHEN_PRINTER_NAME);

            console.log('✅ Windows print successful');

            res.json({
                success: true,
                message: 'Kitchen ticket printed successfully via Windows printer',
                printer: KITCHEN_PRINTER_NAME,
                method: 'windows',
                timestamp: new Date().toISOString(),
                itemCount: orderData.items.length
            });
        }

    } catch (error) {
        console.error('Kitchen print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            printer: KITCHEN_PRINTER_NAME
        });
    }
});

// Receipt printer (placeholder for future)
app.post('/print/receipt', (req, res) => {
    try {
        const receiptData = req.body;
        console.log('Receipt print request:', JSON.stringify(receiptData, null, 2));

        if (!receiptData.total) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid receipt data: total required' 
            });
        }

        console.log('Receipt printing not yet implemented...');

        res.json({
            success: true,
            message: 'Receipt functionality coming soon',
            printer: 'Future Implementation',
            timestamp: new Date().toISOString(),
            total: receiptData.total
        });

    } catch (error) {
        console.error('Receipt print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test printer
app.post('/print/test', async (req, res) => {
    try {
        const printerType = req.body.printer || 'kitchen';
        console.log('Test print request for:', printerType);

        if (printerType === 'kitchen' || printerType === 'both') {
            // Test kitchen printer
            const testOrder = {
                orderNumber: 'TEST-001',
                orderType: 'TEST',
                items: [
                    { name: 'Test Item 1', quantity: 1 },
                    { name: 'Test Item 2', quantity: 2, modifiers: ['Extra Spicy'] }
                ],
                specialInstructions: 'This is a test print'
            };

            try {
                const printer = formatKitchenTicket(testOrder);
                const isConnected = await printer.isPrinterConnected();

                if (isConnected) {
                    await printer.execute();

                    res.json({
                        success: true,
                        message: 'Test print successful via thermal printer',
                        printer: KITCHEN_PRINTER_NAME,
                        method: 'thermal',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    throw new Error('Thermal printer not connected');
                }
            } catch (thermalError) {
                // Fallback to Windows printer
                await printToWindowsPrinter('TEST PRINT - Kitchen Order Test', KITCHEN_PRINTER_NAME);

                res.json({
                    success: true,
                    message: 'Test print successful via Windows printer',
                    printer: KITCHEN_PRINTER_NAME,
                    method: 'windows',
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            res.json({
                success: true,
                message: 'Test completed (no printers specified)',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Test print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log('=================================');
    console.log('🖨️  Cottage Tandoori Printer Service');
    console.log('🚀 Server running on http://127.0.0.1:' + PORT);
    console.log(`🖨️  Configured printer: ${KITCHEN_PRINTER_NAME}`);
    console.log('📡 Endpoints available:');
    console.log('   GET  /health - Health check');
    console.log('   POST /print/kitchen - Kitchen printing');
    console.log('   POST /print/receipt - Receipt printing');
    console.log('   POST /print/test - Test printing');
    console.log('=================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down printer service...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down printer service...');
    process.exit(0);
});
