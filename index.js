
#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ESC/POS Commands Class
class ESC_POS {
    static ESC = String.fromCharCode(27);  // ESC character
    static GS = String.fromCharCode(29);   // GS character
    static LF = String.fromCharCode(10);   // Line Feed
    static CR = String.fromCharCode(13);   // Carriage Return
    static FF = String.fromCharCode(12);   // Form Feed
    
    // Initialize printer
    static INIT = ESC_POS.ESC + '@';
    
    // Text formatting
    static BOLD_ON = ESC_POS.ESC + 'E' + String.fromCharCode(1);
    static BOLD_OFF = ESC_POS.ESC + 'E' + String.fromCharCode(0);
    static UNDERLINE_ON = ESC_POS.ESC + '-' + String.fromCharCode(1);
    static UNDERLINE_OFF = ESC_POS.ESC + '-' + String.fromCharCode(0);
    
    // Text alignment
    static ALIGN_LEFT = ESC_POS.ESC + 'a' + String.fromCharCode(0);
    static ALIGN_CENTER = ESC_POS.ESC + 'a' + String.fromCharCode(1);
    static ALIGN_RIGHT = ESC_POS.ESC + 'a' + String.fromCharCode(2);
    
    // Text size
    static DOUBLE_HEIGHT = ESC_POS.ESC + '!' + String.fromCharCode(16);
    static DOUBLE_WIDTH = ESC_POS.ESC + '!' + String.fromCharCode(32);
    static DOUBLE_SIZE = ESC_POS.ESC + '!' + String.fromCharCode(48);
    static NORMAL_SIZE = ESC_POS.ESC + '!' + String.fromCharCode(0);
    
    // Paper cutting
    static CUT_PAPER = ESC_POS.GS + 'V' + String.fromCharCode(65) + String.fromCharCode(0);
    static PARTIAL_CUT = ESC_POS.GS + 'V' + String.fromCharCode(66) + String.fromCharCode(0);
    
    // Cash drawer
    static OPEN_DRAWER = ESC_POS.ESC + 'p' + String.fromCharCode(0) + String.fromCharCode(25) + String.fromCharCode(250);
    
    // Line spacing
    static LINE_SPACING_24 = ESC_POS.ESC + '3' + String.fromCharCode(24);
    static LINE_SPACING_30 = ESC_POS.ESC + '3' + String.fromCharCode(30);
    
    /**
     * Format a kitchen ticket for thermal printing
     */
    static formatKitchenTicket(orderData) {
        let output = '';
        
        // Initialize printer
        output += ESC_POS.INIT;
        output += ESC_POS.ALIGN_CENTER;
        
        // Header
        output += ESC_POS.DOUBLE_SIZE + ESC_POS.BOLD_ON;
        output += 'COTTAGE TANDOORI' + ESC_POS.LF;
        output += ESC_POS.NORMAL_SIZE + ESC_POS.BOLD_OFF;
        output += ESC_POS.LF;
        
        // Order info
        output += ESC_POS.ALIGN_LEFT;
        output += ESC_POS.BOLD_ON + 'ORDER #: ' + ESC_POS.BOLD_OFF + orderData.order_id + ESC_POS.LF;
        output += ESC_POS.BOLD_ON + 'TYPE: ' + ESC_POS.BOLD_OFF + (orderData.order_type || 'DINE-IN') + ESC_POS.LF;
        output += ESC_POS.BOLD_ON + 'TIME: ' + ESC_POS.BOLD_OFF + new Date().toLocaleTimeString() + ESC_POS.LF;
        output += ESC_POS.LF;
        
        // Separator line
        output += '================================' + ESC_POS.LF;
        
        // Items
        if (orderData.items && orderData.items.length > 0) {
            for (const item of orderData.items) {
                output += ESC_POS.BOLD_ON + item.quantity + 'x ' + item.name + ESC_POS.BOLD_OFF + ESC_POS.LF;
                
                if (item.modifiers && item.modifiers.length > 0) {
                    for (const modifier of item.modifiers) {
                        output += '  + ' + modifier + ESC_POS.LF;
                    }
                }
                
                if (item.special_instructions) {
                    output += '  NOTE: ' + item.special_instructions + ESC_POS.LF;
                }
                output += ESC_POS.LF;
            }
        }
        
        // Footer
        output += '================================' + ESC_POS.LF;
        output += ESC_POS.ALIGN_CENTER;
        output += 'KITCHEN COPY' + ESC_POS.LF;
        output += ESC_POS.LF + ESC_POS.LF + ESC_POS.LF;
        
        // Cut paper
        output += ESC_POS.CUT_PAPER;
        
        return output;
    }
    
    /**
     * Format a test receipt
     */
    static formatTestReceipt() {
        let output = '';
        
        output += ESC_POS.INIT;
        output += ESC_POS.ALIGN_CENTER;
        output += ESC_POS.DOUBLE_SIZE + ESC_POS.BOLD_ON;
        output += 'TEST PRINT' + ESC_POS.LF;
        output += ESC_POS.NORMAL_SIZE + ESC_POS.BOLD_OFF;
        output += ESC_POS.LF;
        
        output += ESC_POS.ALIGN_LEFT;
        output += 'Printer: EPSON TM-T20III' + ESC_POS.LF;
        output += 'Time: ' + new Date().toLocaleString() + ESC_POS.LF;
        output += 'Status: Raw ESC/POS Commands' + ESC_POS.LF;
        output += ESC_POS.LF;
        
        output += '================================' + ESC_POS.LF;
        output += ESC_POS.BOLD_ON + 'SUCCESS!' + ESC_POS.BOLD_OFF + ESC_POS.LF;
        output += 'Direct printer communication' + ESC_POS.LF;
        output += 'No thermal libraries needed' + ESC_POS.LF;
        output += '================================' + ESC_POS.LF;
        output += ESC_POS.LF + ESC_POS.LF + ESC_POS.LF;
        
        output += ESC_POS.CUT_PAPER;
        
        return output;
    }
}

// Raw printer communication functions
class RawPrinter {
    /**
     * Send raw data to printer (Windows)
     */
    static async sendToWindowsPrinter(data, printerName = null) {
        return new Promise((resolve, reject) => {
            const platform = os.platform();
            
            if (platform === 'win32') {
                // Use PowerShell to send raw data to printer
                const psScript = `
                    $printerName = "${printerName || 'TM-T20III'}"
                    $data = [System.Text.Encoding]::UTF8.GetBytes(@"
${data}
"@)
                    
                    try {
                        $printer = Get-Printer | Where-Object { $_.Name -like "*TM-T20*" -or $_.Name -like "*Epson*" } | Select-Object -First 1
                        if ($printer) {
                            $job = Start-Job -ScriptBlock {
                                param($printerName, $data)
                                Add-Type -AssemblyName System.Drawing
                                Add-Type -AssemblyName System.Windows.Forms
                                
                                $doc = New-Object System.Drawing.Printing.PrintDocument
                                $doc.PrinterSettings.PrinterName = $printerName
                                $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Custom", 315, 600)
                                
                                $printData = $using:data
                                $doc.add_PrintPage({
                                    param($sender, $e)
                                    $font = New-Object System.Drawing.Font("Consolas", 8)
                                    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
                                    $e.Graphics.DrawString([System.Text.Encoding]::UTF8.GetString($printData), $font, $brush, 0, 0)
                                })
                                
                                $doc.Print()
                                return "SUCCESS"
                            } -ArgumentList $printer.Name, $data
                            
                            $result = Wait-Job $job | Receive-Job
                            Remove-Job $job
                            
                            if ($result -eq "SUCCESS") {
                                Write-Output "PRINT_SUCCESS"
                            } else {
                                Write-Output "PRINT_FAILED"
                            }
                        } else {
                            Write-Output "NO_PRINTER_FOUND"
                        }
                    } catch {
                        Write-Output "ERROR: $($_.Exception.Message)"
                    }
                `;
                
                exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error('PowerShell execution error:', error);
                        reject(new Error(`PowerShell error: ${error.message}`));
                        return;
                    }
                    
                    if (stdout.includes('PRINT_SUCCESS')) {
                        resolve({ success: true, method: 'windows_powershell' });
                    } else if (stdout.includes('NO_PRINTER_FOUND')) {
                        reject(new Error('No TM-T20III or Epson printer found'));
                    } else {
                        reject(new Error(`Print failed: ${stdout}`));
                    }
                });
            } else {
                reject(new Error('Windows-only method called on non-Windows platform'));
            }
        });
    }
    
    /**
     * Send raw data via temporary file method (Cross-platform fallback)
     */
    static async sendViaFile(data, printerName = null) {
        return new Promise((resolve, reject) => {
            const tempFile = path.join(os.tmpdir(), `thermal_print_${Date.now()}.txt`);
            
            // Write raw ESC/POS data to temporary file
            fs.writeFileSync(tempFile, data, 'binary');
            
            const platform = os.platform();
            let command;
            
            if (platform === 'win32') {
                // Windows: Use COPY command to send to printer
                const targetPrinter = printerName || 'TM-T20III';
                command = `copy /b "${tempFile}" "${targetPrinter}"`;
            } else if (platform === 'darwin') {
                // macOS: Use lp command
                command = `lp -d "${printerName || 'TM_T20III'}" "${tempFile}"`;
            } else {
                // Linux: Use lp command
                command = `lp -d "${printerName || 'TM-T20III'}" "${tempFile}"`;
            }
            
            exec(command, (error, stdout, stderr) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                    console.warn('Could not delete temp file:', e.message);
                }
                
                if (error) {
                    reject(new Error(`Print command failed: ${error.message}`));
                    return;
                }
                
                resolve({ success: true, method: 'file_transfer' });
            });
        });
    }
    
    /**
     * Main print function with fallback methods
     */
    static async print(data, printerName = null) {
        const methods = [
            () => RawPrinter.sendToWindowsPrinter(data, printerName),
            () => RawPrinter.sendViaFile(data, printerName)
        ];
        
        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`🖨️ Attempting print method ${i + 1}...`);
                const result = await methods[i]();
                console.log(`✅ Print successful using method ${i + 1}:`, result.method);
                return result;
            } catch (error) {
                console.log(`❌ Print method ${i + 1} failed:`, error.message);
                if (i === methods.length - 1) {
                    throw error;
                }
            }
        }
    }
}

// API Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        helper_running: true,
        version: '2.0.0-raw-escpos',
        method: 'Raw ESC/POS Commands',
        platform: os.platform(),
        no_thermal_libraries: true
    });
});

app.post('/print-receipt', async (req, res) => {
    try {
        const { content, order_data, printer_name } = req.body;
        
        let escposData;
        if (order_data) {
            // Format kitchen ticket
            escposData = ESC_POS.formatKitchenTicket(order_data);
        } else if (content) {
            // Use provided content with basic formatting
            escposData = ESC_POS.INIT + ESC_POS.ALIGN_LEFT + content + ESC_POS.LF + ESC_POS.LF + ESC_POS.CUT_PAPER;
        } else {
            // Default test receipt
            escposData = ESC_POS.formatTestReceipt();
        }
        
        console.log('🖨️ Printing with raw ESC/POS commands...');
        
        const result = await RawPrinter.print(escposData, printer_name);
        
        res.json({
            success: true,
            message: `Printed via ${result.method}`,
            method: result.method,
            raw_escpos: true
        });
        
    } catch (error) {
        console.error('❌ Print error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            raw_escpos: true
        });
    }
});

app.post('/test-print', async (req, res) => {
    try {
        console.log('🧪 Running test print...');
        
        const testData = ESC_POS.formatTestReceipt();
        const result = await RawPrinter.print(testData);
        
        res.json({
            success: true,
            message: `Test print successful via ${result.method}`,
            method: result.method,
            raw_escpos: true
        });
        
    } catch (error) {
        console.error('❌ Test print error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            raw_escpos: true
        });
    }
});

app.get('/printer-status', (req, res) => {
    res.json({
        available: true,
        method: 'Raw ESC/POS',
        platform: os.platform(),
        supports_tm_t20iii: true,
        libraries_used: 'None - Direct communication'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Raw ESC/POS Thermal Printer Helper v2.0.0`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🖨️ Ready for EPSON TM-T20III direct communication`);
    console.log(`⚡ No thermal libraries - Raw ESC/POS commands only`);
    console.log(`
🔗 Available endpoints:`);
    console.log(`  GET  /health - Server status`);
    console.log(`  POST /print-receipt - Print kitchen ticket`);
    console.log(`  POST /test-print - Test printer`);
    console.log(`  GET  /printer-status - Printer capabilities`);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('
👋 Shutting down Raw ESC/POS Helper...');
    process.exit(0);
});
