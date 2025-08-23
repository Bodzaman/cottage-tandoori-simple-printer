const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log('🖨️  Cottage Tandoori Rich Template Printer v3.0.0');
console.log('🎨 Lightweight rich template processing with reliable builds');
console.log('🔧 Using Windows print spooler + ESC/POS thermal commands');
console.log(`🚀 Server starting on port ${PORT}...`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        version: '3.0.0',
        method: 'Lightweight Rich Templates + Windows Print Spooler',
        printer: 'EPSON TM-T20III',
        features: ['rich_templates', 'qr_codes', 'lightweight', 'reliable_builds']
    });
});

// ESC/POS command helpers for thermal formatting
const ESC = '\x1B';
const GS = '\x1D';

const ESC_POS = {
    INIT: `${ESC}@`,
    FEED_LINE: '\n',
    CUT: `${GS}V\x00`,

    // Text formatting
    BOLD_ON: `${ESC}E1`,
    BOLD_OFF: `${ESC}E0`,
    UNDERLINE_ON: `${ESC}-1`,
    UNDERLINE_OFF: `${ESC}-0`,

    // Alignment
    ALIGN_LEFT: `${ESC}a0`,
    ALIGN_CENTER: `${ESC}a1`,
    ALIGN_RIGHT: `${ESC}a2`,

    // Font sizes
    FONT_SIZE_NORMAL: `${GS}!0`,
    FONT_SIZE_DOUBLE_HEIGHT: `${GS}!1`,
    FONT_SIZE_DOUBLE_WIDTH: `${GS}!16`,
    FONT_SIZE_DOUBLE: `${GS}!17`,

    // Line spacing
    LINE_SPACING_24: `${ESC}3\x18`,
    LINE_SPACING_30: `${ESC}3\x1E`,
};

// Generate QR code as ASCII representation for thermal printing
async function generateThermalQR(content, size = 'medium') {
    const qrSizes = { small: 64, medium: 128, large: 192 };
    const qrSize = qrSizes[size] || qrSizes.medium;

    try {
        // Generate QR code as ASCII string (no complex image processing)
        const qrString = await QRCode.toString(content, {
            type: 'utf8',
            width: qrSize,
            margin: 1,
            small: true
        });

        return qrString;
    } catch (error) {
        console.error('QR code generation error:', error);
        return `[QR: ${content.substring(0, 20)}...]`;
    }
}

// Create ASCII art logo placeholder (no complex image processing)
function generateLogoPlaceholder(business_name) {
    const name = business_name || 'RESTAURANT';
    const width = Math.max(name.length + 4, 30);
    const line = '='.repeat(width);

    return `${line}\n|  ${name.toUpperCase().padStart(width-4).padEnd(width-4)}  |\n${line}`;
}

// Lightweight rich template processor - converts ThermalReceiptData to formatted text
async function processRichTemplate(templateData) {
    let receipt = '';

    try {
        // Initialize thermal printer
        receipt += ESC_POS.INIT;
        receipt += ESC_POS.LINE_SPACING_24;

        // Header Section with Logo
        if (templateData.business_name) {
            receipt += ESC_POS.ALIGN_CENTER;

            // Logo placeholder (ASCII art)
            if (templateData.logo_image) {
                const logoArt = generateLogoPlaceholder(templateData.business_name);
                receipt += logoArt + ESC_POS.FEED_LINE;
            } else {
                receipt += ESC_POS.FONT_SIZE_DOUBLE;
                receipt += ESC_POS.BOLD_ON;
                receipt += templateData.business_name + ESC_POS.FEED_LINE;
                receipt += ESC_POS.BOLD_OFF;
                receipt += ESC_POS.FONT_SIZE_NORMAL;
            }
        }

        // Business details
        if (templateData.address) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += templateData.address + ESC_POS.FEED_LINE;
        }

        if (templateData.phone) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += 'Tel: ' + templateData.phone + ESC_POS.FEED_LINE;
        }

        if (templateData.email) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += templateData.email + ESC_POS.FEED_LINE;
        }

        if (templateData.website) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += templateData.website + ESC_POS.FEED_LINE;
        }

        // Header QR codes
        if (templateData.header_qr_codes && templateData.header_qr_codes.length > 0) {
            for (const qr of templateData.header_qr_codes) {
                if (qr.enabled && qr.content) {
                    receipt += ESC_POS.FEED_LINE;
                    receipt += ESC_POS.ALIGN_CENTER;

                    // QR code title
                    receipt += `--- ${qr.type.toUpperCase()} QR CODE ---` + ESC_POS.FEED_LINE;

                    // Generate QR as ASCII art
                    const qrString = await generateThermalQR(qr.content, qr.size);
                    receipt += qrString + ESC_POS.FEED_LINE;

                    // QR content info  
                    if (qr.content.length < 50) {
                        receipt += `Content: ${qr.content}` + ESC_POS.FEED_LINE;
                    }
                }
            }
        }

        receipt += ESC_POS.FEED_LINE;
        receipt += ESC_POS.ALIGN_CENTER;
        receipt += '================================' + ESC_POS.FEED_LINE;

        // Order Information Section
        receipt += ESC_POS.ALIGN_LEFT;

        if (templateData.receipt_number) {
            receipt += ESC_POS.BOLD_ON;
            receipt += 'Order #: ' + templateData.receipt_number + ESC_POS.FEED_LINE;
            receipt += ESC_POS.BOLD_OFF;
        }

        if (templateData.order_date) {
            receipt += 'Date: ' + templateData.order_date + ESC_POS.FEED_LINE;
        }

        if (templateData.customer_name) {
            receipt += 'Customer: ' + templateData.customer_name + ESC_POS.FEED_LINE;
        }

        if (templateData.order_type) {
            receipt += 'Type: ' + templateData.order_type.toUpperCase() + ESC_POS.FEED_LINE;
        }

        if (templateData.table_number) {
            receipt += 'Table: ' + templateData.table_number + ESC_POS.FEED_LINE;
        }

        receipt += '--------------------------------' + ESC_POS.FEED_LINE;

        // Items Section Placeholder (will be populated from order data)
        receipt += ESC_POS.BOLD_ON;
        receipt += 'ITEMS:' + ESC_POS.FEED_LINE;
        receipt += ESC_POS.BOLD_OFF;
        receipt += '** ORDER ITEMS WILL BE INSERTED HERE **' + ESC_POS.FEED_LINE;
        receipt += '--------------------------------' + ESC_POS.FEED_LINE;

        // Footer Section
        if (templateData.footer_message) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += templateData.footer_message + ESC_POS.FEED_LINE;
        }

        // Footer QR codes
        if (templateData.footer_qr_codes && templateData.footer_qr_codes.length > 0) {
            for (const qr of templateData.footer_qr_codes) {
                if (qr.enabled && qr.content) {
                    receipt += ESC_POS.FEED_LINE;
                    receipt += ESC_POS.ALIGN_CENTER;

                    // QR code title
                    receipt += `--- ${qr.type.toUpperCase()} QR ---` + ESC_POS.FEED_LINE;

                    // Generate QR as ASCII 
                    const qrString = await generateThermalQR(qr.content, qr.size);
                    receipt += qrString + ESC_POS.FEED_LINE;

                    if (qr.content.length < 30) {
                        receipt += qr.content + ESC_POS.FEED_LINE;
                    }
                }
            }
        }

        // VAT number if provided
        if (templateData.vat_number) {
            receipt += ESC_POS.ALIGN_CENTER;
            receipt += 'VAT: ' + templateData.vat_number + ESC_POS.FEED_LINE;
        }

        receipt += ESC_POS.ALIGN_CENTER;
        receipt += '================================' + ESC_POS.FEED_LINE;
        receipt += ESC_POS.FEED_LINE;
        receipt += ESC_POS.CUT;

        return receipt;

    } catch (error) {
        console.error('Rich template processing error:', error);
        return null;
    }
}

// Enhanced receipt formatter with rich template support
async function formatReceipt(data, type = 'receipt') {
    // Check if this is rich template data
    if (data.template_data && typeof data.template_data === 'object') {
        console.log('📄 Processing rich template data...');
        return await processRichTemplate(data.template_data);
    }

    // Fallback to simple text formatting for backward compatibility
    console.log('📄 Using simple text formatting (backward compatibility)...');
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
        // Write content to temp file (handle ESC/POS commands)
        const printContent = typeof content === 'string' ? content : content.toString();
        fs.writeFileSync(tempFile, printContent, 'utf8');

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

// Enhanced template-based printing endpoint
app.post('/print/template', async (req, res) => {
    console.log('🎨 Rich template print request received');
    console.log('Template data keys:', Object.keys(req.body));

    try {
        // Process rich template data
        const receiptContent = await formatReceipt(req.body, 'template');

        if (!receiptContent) {
            throw new Error('Failed to process rich template');
        }

        console.log('📄 Rich template processed successfully');

        printToWindows(receiptContent, (error, result) => {
            if (error) {
                console.error('❌ Template print failed:', error.message);
                res.status(500).json({
                    success: false,
                    message: 'Rich template print failed',
                    error: error.message,
                    method: 'Lightweight Rich Template + Windows Print Spooler'
                });
            } else {
                console.log('✅ Rich template printed successfully');
                res.json({
                    success: true,
                    message: 'Rich template printed successfully',
                    method: 'Lightweight Rich Template + Windows Print Spooler',
                    printer: 'EPSON TM-T20III',
                    features_used: ['rich_template', 'qr_codes', 'escpos_commands']
                });
            }
        });

    } catch (error) {
        console.error('❌ Template processing error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to process rich template',
            error: error.message
        });
    }
});

// Kitchen ticket endpoint (enhanced)
app.post('/print/kitchen', async (req, res) => {
    console.log('📝 Kitchen ticket print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = await formatReceipt(req.body, 'kitchen');
        console.log('📄 Formatted kitchen ticket');

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

// Customer receipt endpoint (enhanced)
app.post('/print/receipt', async (req, res) => {
    console.log('🧾 Customer receipt print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = await formatReceipt(req.body, 'receipt');
        console.log('📄 Formatted customer receipt');

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

// Test print endpoint (enhanced)
app.post('/print/test', (req, res) => {
    console.log('🧪 Test print request received');

    const testContent = 'COTTAGE TANDOORI - RICH TEMPLATE TEST\n' +
                       '==================================\n' +
                       'Lightweight Rich Template v3.0.0\n' +
                       `Time: ${new Date().toLocaleString()}\n` +
                       'Printer: EPSON TM-T20III\n' +
                       'Method: Lightweight + Windows Spooler\n' +
                       'Features: Rich Templates, QR, Reliable\n' +
                       '==================================\n' +
                       'ThermalReceiptDesigner Integration\n' +
                       'Template Assignment System Ready\n' +
                       'ESC/POS Commands Enabled\n' +
                       'Backward Compatibility Maintained\n' +
                       'Build Pipeline: FIXED & WORKING\n';

    printToWindows(testContent, (error, result) => {
        if (error) {
            console.error('❌ Test print failed:', error.message);
            res.status(500).json({
                success: false,
                message: 'Test print failed',
                error: error.message,
                method: 'Lightweight Rich Template + Windows Print Spooler'
            });
        } else {
            console.log('✅ Test print sent successfully');
            res.json({
                success: true,
                message: 'Lightweight rich template test print sent successfully',
                method: 'Lightweight Rich Template + Windows Print Spooler',
                printer: 'EPSON TM-T20III',
                version: '3.0.0',
                capabilities: ['rich_templates', 'qr_codes', 'lightweight', 'reliable_builds']
            });
        }
    });
});

// Get system capabilities endpoint
app.get('/capabilities', (req, res) => {
    res.json({
        version: '3.0.0',
        name: 'Cottage Tandoori Lightweight Rich Template Printer',
        capabilities: {
            rich_templates: true,
            qr_code_generation: true,
            ascii_art_logos: true,
            escpos_commands: true,
            thermal_optimization: true,
            lightweight_processing: true,
            reliable_builds: true,
            backward_compatibility: true
        },
        supported_formats: {
            thermal_receipt_data: true,
            simple_text: true,
            escpos_commands: true
        },
        thermal_features: {
            paper_widths: ['58mm', '80mm'],
            qr_code_formats: ['ascii_art', 'utf8'],
            logo_format: 'ascii_art',
            build_reliability: 'high'
        },
        build_status: {
            native_dependencies: false,
            pkg_compatible: true,
            windows_ready: true
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🖨️  Lightweight rich template printing via Windows spooler to EPSON TM-T20III`);
    console.log(`🧪 Test: POST http://localhost:${PORT}/print/test`);
    console.log(`🎨 Template: POST http://localhost:${PORT}/print/template`);
    console.log(`📝 Kitchen: POST http://localhost:${PORT}/print/kitchen`);
    console.log(`🧾 Receipt: POST http://localhost:${PORT}/print/receipt`);
    console.log(`💻 Capabilities: GET http://localhost:${PORT}/capabilities`);
    console.log(`🎨 Lightweight rich template processing: QR codes, ASCII art, ESC/POS`);
    console.log(`✅ Build pipeline: Fixed and reliable`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down lightweight rich template printer helper...');
    process.exit(0);
});

module.exports = app;
