const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.json({
        status: 'healthy',
        service: 'cottage-tandoori-simple-printer',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        port: PORT,
        printers: {
            kitchen: 'EPSON TM-T20III Receipt',
            receipt: 'EPSON TM-T88V Receipt'
        }
    });
});

// Kitchen print endpoint
app.post('/print/kitchen', (req, res) => {
    console.log('Kitchen print requested:', req.body);

    const order = req.body;

    // Simulate kitchen ticket printing
    console.log('🍳 KITCHEN TICKET:');
    console.log('==================');
    console.log(`Order #: ${order.orderNumber || 'TEST-001'}`);
    console.log(`Items: ${JSON.stringify(order.items || ['Test Item'], null, 2)}`);
    console.log(`Special Instructions: ${order.specialInstructions || 'None'}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('==================');

    res.json({
        success: true,
        message: 'Kitchen ticket printed successfully',
        printer: 'EPSON TM-T20III Receipt',
        orderNumber: order.orderNumber,
        timestamp: new Date().toISOString()
    });
});

// Receipt print endpoint  
app.post('/print/receipt', (req, res) => {
    console.log('Receipt print requested:', req.body);

    const order = req.body;

    // Simulate customer receipt printing
    console.log('🧾 CUSTOMER RECEIPT:');
    console.log('====================');
    console.log(`Order #: ${order.orderNumber || 'TEST-001'}`);
    console.log(`Total: £${order.total || '15.99'}`);
    console.log(`Payment: ${order.payment || 'Card'}`);
    console.log(`Customer: ${order.customerName || 'Walk-in'}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('====================');

    res.json({
        success: true,
        message: 'Receipt printed successfully',
        printer: 'EPSON TM-T88V Receipt',
        orderNumber: order.orderNumber,
        total: order.total,
        timestamp: new Date().toISOString()
    });
});

// Test print endpoint
app.post('/print/test', (req, res) => {
    console.log('Test print requested');

    // Simulate test printing to both printers
    console.log('🧪 TEST PRINT');
    console.log('=============');
    console.log('Kitchen Printer: TM-T20III - ✅ Ready');
    console.log('Receipt Printer: TM-T88V - ✅ Ready');
    console.log('Test completed at:', new Date().toLocaleString());
    console.log('=============');

    res.json({
        success: true,
        message: 'Test print completed successfully',
        printers: {
            kitchen: {
                name: 'EPSON TM-T20III Receipt',
                status: 'ready',
                test: 'passed'
            },
            receipt: {
                name: 'EPSON TM-T88V Receipt', 
                status: 'ready',
                test: 'passed'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// List available printers endpoint
app.get('/printers', (req, res) => {
    console.log('Printer list requested');

    res.json({
        available: [
            {
                name: 'EPSON TM-T20III Receipt',
                type: 'kitchen',
                status: 'ready',
                connection: 'USB',
                capabilities: ['text', 'graphics', 'cut']
            },
            {
                name: 'EPSON TM-T88V Receipt',
                type: 'receipt', 
                status: 'ready',
                connection: 'USB',
                capabilities: ['text', 'graphics', 'cut', 'drawer']
            }
        ],
        count: 2,
        timestamp: new Date().toISOString()
    });
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🖨️  Cottage Tandoori Simple Printer Server`);
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Health check: GET /health`);
        console.log(`🍳 Kitchen print: POST /print/kitchen`);
        console.log(`🧾 Receipt print: POST /print/receipt`);
        console.log(`🧪 Test print: POST /print/test`);
        console.log(`📋 List printers: GET /printers`);
        console.log(`⚡ Ready for POSII integration`);
    });
}

module.exports = app;
