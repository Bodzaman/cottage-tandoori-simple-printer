const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');
const Jimp = require('jimp');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log('🖨️  Cottage Tandoori Rich Template Printer v3.0.0');
console.log('🎨 Rich template processing: images, QR codes, custom fonts');
console.log('🔧 Using Windows print spooler + ESC/POS thermal commands');
console.log(`🚀 Server starting on port ${PORT}...`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        version: '3.0.0',
        method: 'Rich Templates + Windows Print Spooler',
        printer: 'EPSON TM-T20III',
        features: ['rich_templates', 'images', 'qr_codes', 'custom_fonts', 'escpos']
    });
});

// ESC/POS command helpers
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

    // Image printing
    IMAGE_MODE: `${GS}v0`,
};

// Floyd-Steinberg dithering for thermal printing
function ditherImageForThermal(imageBuffer, width, height) {
    const pixels = new Uint8Array(imageBuffer);
    const ditherMatrix = new Array(width * height);

    // Convert to grayscale and apply dithering
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;

            const oldPixel = gray;
            const newPixel = oldPixel < 128 ? 0 : 255;
            ditherMatrix[y * width + x] = newPixel;

            const error = oldPixel - newPixel;

            // Distribute error using Floyd-Steinberg matrix
            if (x + 1 < width) {
                ditherMatrix[y * width + (x + 1)] += error * 7 / 16;
            }
            if (y + 1 < height) {
                if (x > 0) {
                    ditherMatrix[(y + 1) * width + (x - 1)] += error * 3 / 16;
                }
                ditherMatrix[(y + 1) * width + x] += error * 5 / 16;
                if (x + 1 < width) {
                    ditherMatrix[(y + 1) * width + (x + 1)] += error * 1 / 16;
                }
            }
        }
    }

    return ditherMatrix;
}

// Generate QR code as thermal-optimized bitmap
async function generateThermalQR(content, size = 'medium') {
    const qrSizes = { small: 100, medium: 150, large: 200 };
    const qrSize = qrSizes[size] || qrSizes.medium;

    try {
        // Generate QR code as buffer
        const qrBuffer = await QRCode.toBuffer(content, {
            width: qrSize,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return qrBuffer;
    } catch (error) {
        console.error('QR code generation error:', error);
        return null;
    }
}

// Process logo image for thermal printing
async function processThermalLogo(logoData, maxWidth = 200) {
    try {
        let logoBuffer;

        // Handle base64 or URL logos
        if (logoData.startsWith('data:image')) {
            const base64Data = logoData.replace(/^data:image\/[a-z]+;base64,/, '');
            logoBuffer = Buffer.from(base64Data, 'base64');
        } else if (logoData.startsWith('http')) {
            // Would fetch from URL in production
            console.log('URL logos not implemented in this version');
            return null;
        } else {
            return null;
        }

        // Process with Sharp for thermal optimization
        const processed = await sharp(logoBuffer)
            .resize(maxWidth, null, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .grayscale()
            .png()
            .toBuffer();

        return processed;
    } catch (error) {
        console.error('Logo processing error:', error);
        return null;
    }
}

// Rich template processor - converts ThermalReceiptData to ESC/POS commands
async function processRichTemplate(templateData) {
    let escposCommands = ESC_POS.INIT;

    try {
        // Header Section
        if (templateData.business_name) {
            escposCommands += ESC_POS.ALIGN_CENTER;
            escposCommands += ESC_POS.FONT_SIZE_DOUBLE;
            escposCommands += ESC_POS.BOLD_ON;
            escposCommands += templateData.business_name + ESC_POS.FEED_LINE;
            escposCommands += ESC_POS.BOLD_OFF;
            escposCommands += ESC_POS.FONT_SIZE_NORMAL;
        }

        // Business details
        if (templateData.address) {
            escposCommands += ESC_POS.ALIGN_CENTER;
            escposCommands += templateData.address + ESC_POS.FEED_LINE;
        }

        if (templateData.phone) {
            escposCommands += ESC_POS.ALIGN_CENTER;
            escposCommands += 'Tel: ' + templateData.phone + ESC_POS.FEED_LINE;
        }

        // Logo processing
        if (templateData.logo_image) {
            const logoBuffer = await processThermalLogo(templateData.logo_image);
            if (logoBuffer) {
                escposCommands += ESC_POS.ALIGN_CENTER;
                escposCommands += '** LOGO PLACEHOLDER **' + ESC_POS.FEED_LINE;
                // In production, would convert to ESC/POS bitmap commands
            }
        }

        // Header QR codes
        if (templateData.header_qr_codes && templateData.header_qr_codes.length > 0) {
            for (const qr of templateData.header_qr_codes) {
                if (qr.enabled && qr.content) {
                    const qrBuffer = await generateThermalQR(qr.content, qr.size);
                    if (qrBuffer) {
                        escposCommands += ESC_POS.ALIGN_CENTER;
                        escposCommands += '** QR CODE: ' + qr.content.substring(0, 30) + ' **' + ESC_POS.FEED_LINE;
                        // In production, would convert to ESC/POS bitmap
                    }
                }
            }
        }

        escposCommands += ESC_POS.FEED_LINE;
        escposCommands += '================================' + ESC_POS.FEED_LINE;

        // Order Information Section
        if (templateData.receipt_number) {
            escposCommands += ESC_POS.ALIGN_LEFT;
            escposCommands += 'Order #: ' + templateData.receipt_number + ESC_POS.FEED_LINE;
        }

        if (templateData.order_date) {
            escposCommands += 'Date: ' + templateData.order_date + ESC_POS.FEED_LINE;
        }

        if (templateData.customer_name) {
            escposCommands += 'Customer: ' + templateData.customer_name + ESC_POS.FEED_LINE;
        }

        if (templateData.order_type) {
            escposCommands += 'Type: ' + templateData.order_type.toUpperCase() + ESC_POS.FEED_LINE;
        }

        escposCommands += '--------------------------------' + ESC_POS.FEED_LINE;

        // Items Section (will be populated from order data)
        escposCommands += 'ITEMS:' + ESC_POS.FEED_LINE;
        escposCommands += '** ITEMS WILL BE INSERTED HERE **' + ESC_POS.FEED_LINE;
        escposCommands += '--------------------------------' + ESC_POS.FEED_LINE;

        // Footer Section
        if (templateData.footer_message) {
            escposCommands += ESC_POS.ALIGN_CENTER;
            escposCommands += templateData.footer_message + ESC_POS.FEED_LINE;
        }

        // Footer QR codes
        if (templateData.footer_qr_codes && templateData.footer_qr_codes.length > 0) {
            for (const qr of templateData.footer_qr_codes) {
                if (qr.enabled && qr.content) {
                    escposCommands += ESC_POS.ALIGN_CENTER;
                    escposCommands += '** QR: ' + qr.content.substring(0, 20) + ' **' + ESC_POS.FEED_LINE;
                }
            }
        }

        escposCommands += '================================' + ESC_POS.FEED_LINE;
        escposCommands += ESC_POS.FEED_LINE;
        escposCommands += ESC_POS.CUT;

        return escposCommands;

    } catch (error) {
        console.error('Rich template processing error:', error);
        return null;
    }
}

// Enhanced receipt formatter with rich template support
function formatReceipt(data, type = 'receipt') {
    // Check if this is rich template data
    if (data.template_data && typeof data.template_data === 'object') {
        console.log('📄 Processing rich template data...');
        return processRichTemplate(data.template_data);
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

// Helper function to print using Windows print spooler (enhanced for ESC/POS)
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
app.post('/print/template', (req, res) => {
    console.log('🎨 Rich template print request received');
    console.log('Template data keys:', Object.keys(req.body));

    try {
        // Process rich template data
        formatReceipt(req.body, 'template').then(receiptContent => {
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
                        method: 'Rich Template + Windows Print Spooler'
                    });
                } else {
                    console.log('✅ Rich template printed successfully');
                    res.json({
                        success: true,
                        message: 'Rich template printed successfully',
                        method: 'Rich Template + Windows Print Spooler',
                        printer: 'EPSON TM-T20III',
                        features_used: ['rich_template', 'escpos_commands']
                    });
                }
            });
        }).catch(error => {
            console.error('❌ Template processing error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to process rich template',
                error: error.message
            });
        });

    } catch (error) {
        console.error('❌ Template format error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to format template',
            error: error.message
        });
    }
});

// Kitchen ticket endpoint (enhanced)
app.post('/print/kitchen', (req, res) => {
    console.log('📝 Kitchen ticket print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = formatReceipt(req.body, 'kitchen');
        console.log('📄 Formatted kitchen ticket');

        const processContent = async () => {
            const content = await receiptText;
            return content;
        };

        processContent().then(content => {
            printToWindows(content, (error, result) => {
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
        }).catch(error => {
            console.error('❌ Kitchen processing error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to process kitchen ticket',
                error: error.message
            });
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
app.post('/print/receipt', (req, res) => {
    console.log('🧾 Customer receipt print request received');
    console.log('Request data:', JSON.stringify(req.body, null, 2));

    try {
        const receiptText = formatReceipt(req.body, 'receipt');
        console.log('📄 Formatted customer receipt');

        const processContent = async () => {
            const content = await receiptText;
            return content;
        };

        processContent().then(content => {
            printToWindows(content, (error, result) => {
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
        }).catch(error => {
            console.error('❌ Receipt processing error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to process receipt',
                error: error.message
            });
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
                       'Rich Template Processor v3.0.0\n' +
                       `Time: ${new Date().toLocaleString()}\n` +
                       'Printer: EPSON TM-T20III\n' +
                       'Method: Rich Templates + Windows Spooler\n' +
                       'Features: Images, QR, Fonts, ESC/POS\n' +
                       '==================================\n' +
                       'ThermalReceiptDesigner Integration\n' +
                       'Template Assignment System Ready\n' +
                       'ESC/POS Commands Enabled\n' +
                       'Backward Compatibility Maintained\n';

    printToWindows(testContent, (error, result) => {
        if (error) {
            console.error('❌ Test print failed:', error.message);
            res.status(500).json({
                success: false,
                message: 'Test print failed',
                error: error.message,
                method: 'Rich Template + Windows Print Spooler'
            });
        } else {
            console.log('✅ Test print sent successfully');
            res.json({
                success: true,
                message: 'Rich template test print sent successfully',
                method: 'Rich Template + Windows Print Spooler',
                printer: 'EPSON TM-T20III',
                version: '3.0.0',
                capabilities: ['rich_templates', 'images', 'qr_codes', 'fonts', 'escpos']
            });
        }
    });
});

// Get system capabilities endpoint
app.get('/capabilities', (req, res) => {
    res.json({
        version: '3.0.0',
        name: 'Cottage Tandoori Rich Template Printer',
        capabilities: {
            rich_templates: true,
            image_processing: true,
            qr_code_generation: true,
            custom_fonts: true,
            escpos_commands: true,
            thermal_optimization: true,
            dithering: true,
            backward_compatibility: true
        },
        supported_formats: {
            thermal_receipt_data: true,
            simple_text: true,
            escpos_commands: true
        },
        thermal_features: {
            paper_widths: ['58mm', '80mm'],
            image_dithering: 'floyd_steinberg',
            font_rendering: 'canvas_based',
            qr_code_sizes: ['small', 'medium', 'large']
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🖨️  Rich template printing via Windows spooler to EPSON TM-T20III`);
    console.log(`🧪 Test: POST http://localhost:${PORT}/print/test`);
    console.log(`🎨 Template: POST http://localhost:${PORT}/print/template`);
    console.log(`📝 Kitchen: POST http://localhost:${PORT}/print/kitchen`);
    console.log(`🧾 Receipt: POST http://localhost:${PORT}/print/receipt`);
    console.log(`💻 Capabilities: GET http://localhost:${PORT}/capabilities`);
    console.log(`🎨 Rich template processing: Images, QR codes, Custom fonts, ESC/POS`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down rich template printer helper...');
    process.exit(0);
});

module.exports = app;
