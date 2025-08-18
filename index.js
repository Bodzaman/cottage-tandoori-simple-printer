#!/usr/bin/env node

/**
 * Cottage Tandoori Windows-First Printing Helper
 * 
 * This helper app leverages the Windows print spooler system for reliable
 * thermal receipt printing, eliminating driver conflicts and compatibility issues.
 * 
 * Key Features:
 * - Windows print spooler integration (no thermal libraries)
 * - Works with any Windows-configured printer
 * - Optimized for Epson TM-T20III and TM-T88V
 * - Receipt formatting via Windows print commands
 * - No driver configuration required
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
const PORT = 3001;

// Windows printer configuration
const DEFAULT_PRINTER = "EPSON TM-T20III Receipt";
const BACKUP_PRINTER = "EPSON TM-T88V Receipt";
const THERMAL_WIDTH = 80; // mm
const THERMAL_DPI = 203;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Utility: Check if running on Windows
function isWindows() {
    return os.platform() === 'win32';
}

// Utility: Get available printers via Windows
function getAvailablePrinters() {
    return new Promise((resolve, reject) => {
        if (!isWindows()) {
            return reject(new Error('Windows printing only supported on Windows'));
        }

        exec('wmic printer get name', (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            const printers = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && line !== 'Name')
                .filter(line => !line.includes('Name'));

            resolve(printers);
        });
    });
}

// Utility: Find the best available thermal printer
async function findThermalPrinter() {
    try {
        const printers = await getAvailablePrinters();

        // Look for our known printers in order of preference
        const preferredPrinters = [DEFAULT_PRINTER, BACKUP_PRINTER];

        for (const preferred of preferredPrinters) {
            if (printers.includes(preferred)) {
                console.log(`✅ Found preferred printer: ${preferred}`);
                return preferred;
            }
        }

        // Look for any Epson thermal printer
        const epsonPrinter = printers.find(p => 
            p.toLowerCase().includes('epson') && 
            (p.toLowerCase().includes('tm-') || p.toLowerCase().includes('receipt'))
        );

        if (epsonPrinter) {
            console.log(`✅ Found Epson thermal printer: ${epsonPrinter}`);
            return epsonPrinter;
        }

        // Fallback to first available printer
        if (printers.length > 0) {
            console.log(`⚠️ Using fallback printer: ${printers[0]}`);
            return printers[0];
        }

        throw new Error('No printers available');

    } catch (error) {
        console.error('❌ Error finding thermal printer:', error.message);
        throw error;
    }
}

// Windows Print Formatter Class
class WindowsPrintFormatter {
    constructor() {
        this.content = [];
        this.currentAlignment = 'left';
        this.currentSize = 'normal';
        this.currentBold = false;
    }

    // Text formatting methods
    init() {
        this.content = [];
        return this;
    }

    text(str) {
        this.content.push({
            type: 'text',
            content: str,
            alignment: this.currentAlignment,
            size: this.currentSize,
            bold: this.currentBold
        });
        return this;
    }

    println(str = '') {
        this.text(str + '\n');
        return this;
    }

    alignLeft() {
        this.currentAlignment = 'left';
        return this;
    }

    alignCenter() {
        this.currentAlignment = 'center';
        return this;
    }

    alignRight() {
        this.currentAlignment = 'right';
        return this;
    }

    bold(enabled = true) {
        this.currentBold = enabled;
        return this;
    }

    setTextSize(width, height) {
        if (width > 1 || height > 1) {
            this.currentSize = 'large';
        } else {
            this.currentSize = 'normal';
        }
        return this;
    }

    drawLine(char = '-') {
        const line = char.repeat(48); // 48 chars for 80mm thermal paper
        this.println(line);
        return this;
    }

    newLine() {
        this.println('');
        return this;
    }

    cut() {
        this.content.push({
            type: 'cut',
            content: '\n\n\n' // Add spacing before cut
        });
        return this;
    }

    openDrawer() {
        this.content.push({
            type: 'drawer',
            content: '' // Windows printing doesn't directly support drawer
        });
        return this;
    }

    // Generate plain text output optimized for thermal printing
    generateText() {
        let output = '';

        for (const item of this.content) {
            if (item.type === 'text') {
                let text = item.content;

                // Apply formatting through spacing and characters
                if (item.alignment === 'center') {
                    const padding = Math.max(0, Math.floor((48 - text.replace('\n', '').length) / 2));
                    text = ' '.repeat(padding) + text;
                } else if (item.alignment === 'right') {
                    const padding = Math.max(0, 48 - text.replace('\n', '').length);
                    text = ' '.repeat(padding) + text;
                }

                // Bold simulation with repeated characters (for important headers)
                if (item.bold && item.size === 'large') {
                    text = text.replace(/[A-Z0-9]/g, char => char + char);
                }

                output += text;
            } else if (item.type === 'cut') {
                output += item.content;
            }
        }

        return output;
    }
}

// Format kitchen ticket for Windows printing
function formatKitchenTicket(orderData) {
    const formatter = new WindowsPrintFormatter();

    formatter.init()
        .alignCenter()
        .setTextSize(1, 1)
        .bold(true)
        .println("COTTAGE TANDOORI")
        .println("KITCHEN ORDER")
        .bold(false)
        .drawLine()
        .alignLeft()
        .newLine()
        .bold(true)
        .println(`Order #: ${orderData.orderNumber || 'N/A'}`)
        .println(`Type: ${orderData.orderType || 'DINE-IN'}`)
        .bold(false)
        .println(`Time: ${new Date().toLocaleTimeString()}`)
        .drawLine()
        .newLine();

    // Items
    if (orderData.items && orderData.items.length > 0) {
        formatter.bold(true).println("ITEMS:").bold(false);

        orderData.items.forEach(item => {
            formatter.println(`${item.quantity}x ${item.name}`);

            if (item.modifiers && item.modifiers.length > 0) {
                item.modifiers.forEach(mod => {
                    formatter.println(`  + ${mod.name}`);
                });
            }

            if (item.specialInstructions) {
                formatter.println(`  * ${item.specialInstructions}`);
            }

            formatter.newLine();
        });
    }

    // Special instructions
    if (orderData.specialInstructions) {
        formatter.drawLine()
            .bold(true)
            .println("SPECIAL INSTRUCTIONS:")
            .bold(false)
            .println(orderData.specialInstructions)
            .newLine();
    }

    formatter.drawLine()
        .alignCenter()
        .println("Thank you!")
        .newLine()
        .cut();

    return formatter.generateText();
}

// Format customer receipt for Windows printing
function formatCustomerReceipt(orderData) {
    const formatter = new WindowsPrintFormatter();

    formatter.init()
        .alignCenter()
        .setTextSize(2, 2)
        .bold(true)
        .println("COTTAGE TANDOORI")
        .bold(false)
        .setTextSize(1, 1)
        .println("Authentic Indian Cuisine")
        .println("Tel: 01234 567890")
        .drawLine()
        .alignLeft()
        .newLine()
        .println(`Receipt #: ${orderData.orderNumber || 'N/A'}`)
        .println(`Date: ${new Date().toLocaleDateString()}`)
        .println(`Time: ${new Date().toLocaleTimeString()}`)
        .println(`Type: ${orderData.orderType || 'DINE-IN'}`)
        .drawLine()
        .newLine();

    // Items with prices
    if (orderData.items && orderData.items.length > 0) {
        let total = 0;

        orderData.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            total += itemTotal;

            formatter.println(`${item.quantity}x ${item.name}`)
                .alignRight()
                .println(`£${itemTotal.toFixed(2)}`)
                .alignLeft();

            if (item.modifiers && item.modifiers.length > 0) {
                item.modifiers.forEach(mod => {
                    formatter.println(`  + ${mod.name}`);
                    if (mod.price) {
                        total += mod.price * item.quantity;
                    }
                });
            }
        });

        formatter.drawLine()
            .alignRight()
            .bold(true)
            .println(`TOTAL: £${total.toFixed(2)}`)
            .bold(false)
            .alignLeft();
    }

    formatter.newLine()
        .drawLine()
        .alignCenter()
        .println("Thank you for your order!")
        .println("Please visit again soon")
        .newLine()
        .cut();

    return formatter.generateText();
}

// Print via Windows print spooler
function printViaWindows(content, printerName) {
    return new Promise((resolve, reject) => {
        if (!isWindows()) {
            return reject(new Error('Windows printing only available on Windows'));
        }

        const tempDir = os.tmpdir();
        const filename = `receipt_${Date.now()}.txt`;
        const filepath = path.join(tempDir, filename);

        // Write content to temp file
        fs.writeFileSync(filepath, content, 'utf8');

        // Print via Windows print command
        const printCommand = `print /D:"${printerName}" "${filepath}"`;

        exec(printCommand, (error, stdout, stderr) => {
            // Clean up temp file
            try {
                fs.unlinkSync(filepath);
            } catch (cleanupError) {
                console.warn('Could not clean up temp file:', cleanupError.message);
            }

            if (error) {
                console.error('Print command failed:', error.message);
                return reject(new Error(`Print failed: ${error.message}`));
            }

            console.log('✅ Print job sent successfully');
            resolve({ success: true, message: 'Print job sent to Windows spooler' });
        });
    });
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const printers = await getAvailablePrinters();
        const activePrinter = await findThermalPrinter();

        res.json({
            status: 'healthy',
            platform: os.platform(),
            windows: isWindows(),
            availablePrinters: printers,
            activePrinter: activePrinter,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            platform: os.platform(),
            windows: isWindows(),
            timestamp: new Date().toISOString()
        });
    }
});

// Print kitchen ticket endpoint
app.post('/print/kitchen', async (req, res) => {
    try {
        console.log('🍳 Kitchen ticket print request received');

        const orderData = req.body;
        const content = formatKitchenTicket(orderData);
        const printer = await findThermalPrinter();

        console.log(`📄 Printing kitchen ticket to: ${printer}`);

        const result = await printViaWindows(content, printer);

        res.json({
            success: true,
            message: 'Kitchen ticket printed successfully',
            printer: printer,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Kitchen print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });
    }
});

// Print customer receipt endpoint  
app.post('/print/receipt', async (req, res) => {
    try {
        console.log('🧾 Customer receipt print request received');

        const orderData = req.body;
        const content = formatCustomerReceipt(orderData);
        const printer = await findThermalPrinter();

        console.log(`📄 Printing customer receipt to: ${printer}`);

        const result = await printViaWindows(content, printer);

        res.json({
            success: true,
            message: 'Customer receipt printed successfully',
            printer: printer,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Receipt print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });
    }
});

// Test print endpoint
app.post('/print/test', async (req, res) => {
    try {
        console.log('🧪 Test print request received');

        const testContent = `COTTAGE TANDOORI
Windows Print Test

Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

This is a test print from the
Windows-first printing helper.

✅ If you can read this, 
   Windows printing is working!

Thank you!


`;

        const printer = await findThermalPrinter();
        console.log(`📄 Sending test print to: ${printer}`);

        const result = await printViaWindows(testContent, printer);

        res.json({
            success: true,
            message: 'Test print completed successfully',
            printer: printer,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Test print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });
    }
});

// Get printer status
app.get('/printers', async (req, res) => {
    try {
        const printers = await getAvailablePrinters();
        const activePrinter = await findThermalPrinter();

        res.json({
            available: printers,
            active: activePrinter,
            total: printers.length,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            available: [],
            active: null,
            method: 'windows-spooler',
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🖨️  Cottage Tandoori Windows Printing Helper');
    console.log('=' .repeat(50));
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`💻 Platform: ${os.platform()}`);
    console.log(`🖨️  Print Method: Windows Spooler`);
    console.log(`🔧 Target Printer: ${DEFAULT_PRINTER}`);
    console.log('=' .repeat(50));

    if (!isWindows()) {
        console.warn('⚠️  Warning: This helper is optimized for Windows');
        console.warn('   Some features may not work on other platforms');
    }

    // Test printer availability on startup
    findThermalPrinter()
        .then(printer => {
            console.log(`✅ Found thermal printer: ${printer}`);
        })
        .catch(error => {
            console.error(`❌ Printer detection failed: ${error.message}`);
            console.log('💡 Please ensure Windows printer is properly configured');
        });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Cottage Tandoori Windows Printing Helper...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
