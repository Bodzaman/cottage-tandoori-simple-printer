const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = 3001;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        nodeVersion: process.version,
        port: PORT
    });
});

// Kitchen printer endpoint
app.post('/print/kitchen', (req, res) => {
    try {
        const orderData = req.body;
        console.log('Kitchen print request:', JSON.stringify(orderData, null, 2));

        // Basic validation
        if (!orderData.items || !Array.isArray(orderData.items)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid order data: items array required' 
            });
        }

        // Simulate printing process
        console.log('Printing to kitchen (TM-T20III)...');

        res.json({
            success: true,
            message: 'Kitchen ticket printed successfully',
            printer: 'TM-T20III',
            timestamp: new Date().toISOString(),
            itemCount: orderData.items.length
        });

    } catch (error) {
        console.error('Kitchen print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Receipt printer endpoint
app.post('/print/receipt', (req, res) => {
    try {
        const receiptData = req.body;
        console.log('Receipt print request:', JSON.stringify(receiptData, null, 2));

        // Basic validation
        if (!receiptData.total) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid receipt data: total required' 
            });
        }

        // Simulate printing process
        console.log('Printing receipt (TM-T88V)...');

        res.json({
            success: true,
            message: 'Receipt printed successfully',
            printer: 'TM-T88V',
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

// Test print endpoint
app.post('/print/test', (req, res) => {
    try {
        const printerType = req.body.printer || 'both';
        console.log(`Test print request for: ${printerType}`);

        const testResults = {
            timestamp: new Date().toISOString(),
            tests: []
        };

        if (printerType === 'kitchen' || printerType === 'both') {
            testResults.tests.push({
                printer: 'TM-T20III',
                type: 'kitchen',
                status: 'success',
                message: 'Kitchen printer test completed'
            });
        }

        if (printerType === 'receipt' || printerType === 'both') {
            testResults.tests.push({
                printer: 'TM-T88V',
                type: 'receipt',
                status: 'success',
                message: 'Receipt printer test completed'
            });
        }

        res.json({
            success: true,
            message: 'Test print completed',
            results: testResults
        });

    } catch (error) {
        console.error('Test print error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`=================================`);
    console.log(`🖨️  Cottage Tandoori Printer Service`);
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
    console.log(`📡 Endpoints available:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   POST /print/kitchen - Kitchen printing`);
    console.log(`   POST /print/receipt - Receipt printing`);
    console.log(`   POST /print/test - Test printing`);
    console.log(`=================================`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down printer service...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down printer service...');
    process.exit(0);
});
