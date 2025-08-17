# Cottage Tandoori Simple Printer

Simple Node.js HTTP server for Epson thermal printer integration with POSII. Provides basic HTTP endpoints for kitchen tickets and customer receipts via TM-T20III and TM-T88V printers.

## Features

🖨️ **Hybrid Printing Strategy**
- Primary: Windows printer system via installed drivers  
- Fallback: ESC/POS commands via node-thermal-printer
- Automatic error handling and method switching

🏪 **Restaurant-Ready Templates**
- Kitchen tickets optimized for TM-T20III
- Customer receipts formatted for TM-T88V
- Cottage Tandoori branding and layout

🔌 **Simple HTTP API**
- RESTful endpoints for easy integration
- JSON request/response format
- Health monitoring and printer status

## Quick Start

### Download & Run
1. Download `cottage-printer.exe` from [Releases](https://github.com/Bodzaman/cottage-tandoori-simple-printer/releases)
2. Run the executable (Windows will prompt for permissions)
3. Server starts on `http://localhost:3001`
4. Check health: `http://localhost:3001/health`

### Prerequisites
- Windows 10/11
- Epson TM-T20III (kitchen printer)
- Epson TM-T88V (receipt printer)  
- Proper Epson drivers installed
- USB connections configured

## API Documentation

### Base URL
```
http://localhost:3001
```

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-08-17T23:00:00.000Z",
  "printers": {
    "kitchen": {
      "name": "EPSON TM-T20III Receipt",
      "available": true
    },
    "receipt": {
      "name": "EPSON TM-T88V Receipt", 
      "available": true
    }
  },
  "totalPrinters": 4
}
```

#### Print Kitchen Ticket
```http
POST /print/kitchen
Content-Type: application/json
```

**Request Body:**
```json
{
  "orderId": "12345",
  "customerName": "John Smith",
  "orderType": "DELIVERY",
  "timestamp": "2024-08-17T23:00:00.000Z",
  "items": [
    {
      "name": "Chicken Tikka Masala",
      "quantity": 2,
      "modifications": ["Extra Spicy", "No Coriander"],
      "notes": "Table 5"
    },
    {
      "name": "Naan Bread",
      "quantity": 3,
      "modifications": ["Garlic"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "12345",
  "printer": "EPSON TM-T20III Receipt",
  "method": "windows",
  "timestamp": "2024-08-17T23:00:00.000Z"
}
```

#### Print Customer Receipt
```http
POST /print/receipt
Content-Type: application/json
```

**Request Body:**
```json
{
  "orderId": "12345",
  "customerName": "John Smith", 
  "orderType": "DELIVERY",
  "timestamp": "2024-08-17T23:00:00.000Z",
  "items": [
    {
      "name": "Chicken Tikka Masala",
      "quantity": 2,
      "price": 12.95
    },
    {
      "name": "Naan Bread", 
      "quantity": 3,
      "price": 3.50
    }
  ],
  "total": 36.40,
  "tax": 4.85
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "12345", 
  "printer": "EPSON TM-T88V Receipt",
  "method": "windows",
  "timestamp": "2024-08-17T23:00:00.000Z"
}
```

#### Test Print
```http
POST /print/test
Content-Type: application/json
```

**Request Body:**
```json
{
  "printer": "kitchen"
}
```
*Options: "kitchen" or "receipt"*

#### List Printers
```http
GET /printers
```

**Response:**
```json
{
  "printers": [
    {
      "name": "EPSON TM-T20III Receipt",
      "status": "IDLE",
      "isDefault": false
    },
    {
      "name": "EPSON TM-T88V Receipt",
      "status": "IDLE", 
      "isDefault": false
    }
  ],
  "target": {
    "kitchen": "EPSON TM-T20III Receipt",
    "receipt": "EPSON TM-T88V Receipt"
  }
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing required fields)
- `500` - Internal Server Error (printing failed)

**Error Response Format:**
```json
{
  "error": "Kitchen printing failed",
  "details": "Printer 'EPSON TM-T20III Receipt' not found"
}
```

## Integration with POSII

This server is designed to integrate seamlessly with the Cottage Tandoori POSII system:

1. **Kitchen Orders**: When POSII creates a new order, send `POST /print/kitchen`
2. **Customer Receipts**: When payment is completed, send `POST /print/receipt`  
3. **Health Monitoring**: Periodically check `GET /health` for printer status
4. **Testing**: Use `POST /print/test` to verify printer connectivity

## Development

### Local Development
```bash
git clone https://github.com/Bodzaman/cottage-tandoori-simple-printer.git
cd cottage-tandoori-simple-printer
npm install
npm run dev
```

### Build Executable
```bash
npm run build
```

The `cottage-printer.exe` will be generated in the `dist/` directory.

## Technical Details

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Printing**: Hybrid Windows/ESC-POS strategy
- **Build**: pkg for Node.js to .exe conversion
- **CI/CD**: GitHub Actions for automated builds

## Support

For technical support or integration questions:
- Check the [Issues](https://github.com/Bodzaman/cottage-tandoori-simple-printer/issues) page
- Contact: Cottage Tandoori Development Team

## License

MIT License - see [LICENSE](LICENSE) file for details.
