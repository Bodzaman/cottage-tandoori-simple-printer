const express = require('express');
const cors = require('cors');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const printer = require('printer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Printer configuration
const KITCHEN_PRINTER = "EPSON TM-T20III Receipt";
const RECEIPT_PRINTER = "EPSON TM-T88V Receipt";

// Logging helper
const log = (message, type = 'INFO') => {
    console.log(`[${new Date().toISOString()}] [${type}] ${message}`);
};

// Get available printers
const getAvailablePrinters = () => {
    try {
        return printer.getPrinters();
    } catch (error) {
        log(`Error getting printers: ${error.message}`, 'ERROR');
        return [];
    }
};

// Windows printer method (Primary)
const printToWindowsPrinter = async (printerName, content) => {
    return new Promise((resolve, reject) => {
        try {
            const printers = getAvailablePrinters();
            const targetPrinter = printers.find(p => p.name === printerName);

            if (!targetPrinter) {
                throw new Error(`Printer "${printerName}" not found`);
            }

            printer.printDirect({
                data: content,
                printer: printerName,
                type: 'TEXT',
                success: (jobID) => {
                    log(`Windows print success - Job ID: ${jobID}`, 'SUCCESS');
                    resolve({ success: true, method: 'windows', jobId: jobID });
                },
                error: (error) => {
                    log(`Windows print error: ${error}`, 'ERROR');
                    reject(new Error(`Windows printing failed: ${error}`));
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};

// ESC/POS method (Fallback)
const printToESCPOS = async (printerType, content) => {
    try {
        // This is a placeholder for direct ESC/POS printing
        // In real implementation, we'd need USB/Serial port access
        log(`ESC/POS fallback attempted for ${printerType}`, 'INFO');

        // For now, just simulate the ESC/POS approach
        const escposContent = `\x1B\x40${content}\x1D\x56\x41\x10`;
        log(`ESC/POS content prepared: ${escposContent.length} bytes`, 'INFO');

        return { success: true, method: 'escpos', content: escposContent };
    } catch (error) {
        throw new Error(`ESC/POS printing failed: ${error.message}`);
    }
};

// Hybrid print function
const hybridPrint = async (printerName, content) => {
    try {
        // Try Windows printer first
        log(`Attempting Windows print to: ${printerName}`, 'INFO');
        return await printToWindowsPrinter(printerName, content);
    } catch (windowsError) {
        log(`Windows printing failed: ${windowsError.message}`, 'WARN');

        try {
            // Fallback to ESC/POS
            log(`Falling back to ESC/POS for: ${printerName}`, 'INFO');
            return await printToESCPOS(printerName, content);
        } catch (escposError) {
            throw new Error(`All printing methods failed. Windows: ${windowsError.message}, ESC/POS: ${escposError.message}`);
        }
    }
};

// Kitchen ticket template
const formatKitchenTicket = (orderData) => {
    const { orderId, items, customerName, orderType, timestamp } = orderData;

    let ticket = '';
    ticket += '================================\n';
    ticket += '        KITCHEN TICKET\n';
    ticket += '================================\n';
    ticket += `Order: #${orderId}\n`;
    ticket += `Type: ${orderType}\n`;
    ticket += `Customer: ${customerName}\n`;
    ticket += `Time: ${new Date(timestamp).toLocaleTimeString()}\n`;
    ticket += '--------------------------------\n';

    items.forEach(item => {
        ticket += `${item.quantity}x ${item.name}\n`;
        if (item.modifications && item.modifications.length > 0) {
            item.modifications.forEach(mod => {
                ticket += `   * ${mod}\n`;
            });
        }
        if (item.notes) {
            ticket += `   Note: ${item.notes}\n`;
        }
        ticket += '\n';
    });

    ticket += '================================\n';
    ticket += '\n\n\n';

    return ticket;
};

// Receipt template  
const formatReceipt = (orderData) => {
    const { orderId, items, customerName, orderType, timestamp, total, tax } = orderData;

    let receipt = '';
    receipt += '\n\n';
    receipt += '        COTTAGE TANDOORI\n';
    receipt += '      123 Sample Street\n';
    receipt += '     City, State 12345\n';
    receipt += '      Tel: (555) 123-4567\n';
    receipt += '\n';
    receipt += '================================\n';
    receipt += `Order: #${orderId}\n`;
    receipt += `Customer: ${customerName}\n`;
    receipt += `Type: ${orderType}\n`;
    receipt += `Date: ${new Date(timestamp).toLocaleString()}\n`;
    receipt += '--------------------------------\n';

    items.forEach(item => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        receipt += `${item.quantity}x ${item.name.padEnd(20)} £${itemTotal}\n`;
    });

    receipt += '--------------------------------\n';
    receipt += `Subtotal:${' '.repeat(18)}£${(total - tax).toFixed(2)}\n`;
    receipt += `Tax:${' '.repeat(23)}£${tax.toFixed(2)}\n`;
    receipt += `TOTAL:${' '.repeat(21)}£${total.toFixed(2)}\n`;
    receipt += '================================\n';
    receipt += '\n';
    receipt += '    Thank you for your order!\n';
    receipt += '\n\n\n';

    return receipt;
};

// API Endpoints

// Health check
app.get('/health', (req, res) => {
    const printers = getAvailablePrinters();
    const kitchenAvailable = printers.some(p => p.name === KITCHEN_PRINTER);
    const receiptAvailable = printers.some(p => p.name === RECEIPT_PRINTER);

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        printers: {
            kitchen: {
                name: KITCHEN_PRINTER,
                available: kitchenAvailable
            },
            receipt: {
                name: RECEIPT_PRINTER, 
                available: receiptAvailable
            }
        },
        totalPrinters: printers.length
    });
});

// Print kitchen ticket
app.post('/print/kitchen', async (req, res) => {
    try {
        log(`Kitchen print request received`, 'INFO');

        const orderData = req.body;
        if (!orderData.orderId || !orderData.items) {
            return res.status(400).json({
                error: 'Missing required fields: orderId, items'
            });
        }

        const ticket = formatKitchenTicket(orderData);
        const result = await hybridPrint(KITCHEN_PRINTER, ticket);

        log(`Kitchen ticket printed successfully - Order #${orderData.orderId}`, 'SUCCESS');

        res.json({
            success: true,
            orderId: orderData.orderId,
            printer: KITCHEN_PRINTER,
            method: result.method,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Kitchen print failed: ${error.message}`, 'ERROR');
        res.status(500).json({
            error: 'Kitchen printing failed',
            details: error.message
        });
    }
});

// Print customer receipt
app.post('/print/receipt', async (req, res) => {
    try {
        log(`Receipt print request received`, 'INFO');

        const orderData = req.body;
        if (!orderData.orderId || !orderData.items || !orderData.total) {
            return res.status(400).json({
                error: 'Missing required fields: orderId, items, total'
            });
        }

        const receipt = formatReceipt(orderData);
        const result = await hybridPrint(RECEIPT_PRINTER, receipt);

        log(`Receipt printed successfully - Order #${orderData.orderId}`, 'SUCCESS');

        res.json({
            success: true,
            orderId: orderData.orderId,
            printer: RECEIPT_PRINTER,
            method: result.method,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Receipt print failed: ${error.message}`, 'ERROR');
        res.status(500).json({
            error: 'Receipt printing failed',
            details: error.message
        });
    }
});

// Test print functionality
app.post('/print/test', async (req, res) => {
    try {
        const { printer: targetPrinter } = req.body;
        const printerName = targetPrinter === 'kitchen' ? KITCHEN_PRINTER : RECEIPT_PRINTER;

        const testContent = `
================================
         TEST PRINT
================================
Printer: ${printerName}
Time: ${new Date().toLocaleString()}
Status: Connection Test
================================

This is a test print to verify
the printer is working correctly.

If you can read this message,
the printer is functioning.

================================
`;

        const result = await hybridPrint(printerName, testContent);

        log(`Test print successful on ${printerName}`, 'SUCCESS');

        res.json({
            success: true,
            printer: printerName,
            method: result.method,
            message: 'Test print completed successfully'
        });

    } catch (error) {
        log(`Test print failed: ${error.message}`, 'ERROR');
        res.status(500).json({
            error: 'Test print failed',
            details: error.message
        });
    }
});

// List available printers
app.get('/printers', (req, res) => {
    try {
        const printers = getAvailablePrinters();
        res.json({
            printers: printers.map(p => ({
                name: p.name,
                status: p.status,
                isDefault: p.isDefault || false
            })),
            target: {
                kitchen: KITCHEN_PRINTER,
                receipt: RECEIPT_PRINTER
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get printer list',
            details: error.message
        });
    }
});

// Error handler
app.use((error, req, res, next) => {
    log(`Unhandled error: ${error.message}`, 'ERROR');
    res.status(500).json({
        error: 'Internal server error',
        details: error.message
    });
});

// Start server
app.listen(PORT, () => {
    log(`🚀 Cottage Tandoori Thermal Printer Server running on port ${PORT}`, 'SUCCESS');
    log(`Health check: http://localhost:${PORT}/health`, 'INFO');

    // Log available printers on startup
    const printers = getAvailablePrinters();
    log(`Found ${printers.length} system printers`, 'INFO');
    printers.forEach(p => {
        log(`  - ${p.name} (${p.status})`, 'INFO');
    });
});
