# Cottage Tandoori Simple Printer

🖨️ **Windows HTTP Thermal Printing Service for POSII Integration**

A lightweight Node.js HTTP server that handles thermal printing for Cottage Tandoori's POSII system, specifically configured for the **EPSON TM-T20III Receipt** printer.

## ✨ Features

- **HTTP API** on port 3001 for seamless POSII integration
- **Thermal printing** with proper kitchen ticket formatting
- **Windows printer fallback** system for reliability
- **Real-time order processing** with modifiers, notes, and special instructions
- **Health monitoring** and error handling

## 🚀 Quick Setup

### 1. Download & Extract
```bash
# Download the latest version
git clone https://github.com/Bodzaman/cottage-tandoori-simple-printer.git
cd cottage-tandoori-simple-printer
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Printer
- **Ensure your EPSON TM-T20III is installed and named exactly: `EPSON TM-T20III Receipt`**
- Verify it prints test pages from Windows
- Make sure it's set as a shared printer if needed

### 4. Start the Service
```bash
npm start
```

You should see:
```
🖨️  Cottage Tandoori Printer Service
🚀 Server running on http://127.0.0.1:3001
🖨️  Configured printer: EPSON TM-T20III Receipt
```

## 📡 API Endpoints

### Health Check
```http
GET http://127.0.0.1:3001/health
```

### Kitchen Printing
```http
POST http://127.0.0.1:3001/print/kitchen
Content-Type: application/json

{
  "orderNumber": "ORDER-001",
  "orderType": "DINE-IN",
  "table": "5",
  "items": [
    {
      "name": "Chicken Tikka Masala",
      "quantity": 2,
      "modifiers": ["Extra Spicy", "No Onions"],
      "notes": "Customer allergic to nuts"
    }
  ],
  "specialInstructions": "Please prepare quickly"
}
```

### Test Printing
```http
POST http://127.0.0.1:3001/print/test
Content-Type: application/json

{
  "printer": "kitchen"
}
```

## 🔧 Troubleshooting

### Printer Not Found
1. Check printer name exactly matches: `EPSON TM-T20III Receipt`
2. Restart printer service
3. Verify Windows can print to the printer

### Connection Issues
1. Check if port 3001 is available
2. Restart the helper app
3. Check firewall settings

### Print Quality Issues
1. Clean printer head
2. Check paper roll
3. Verify printer drivers are updated

## 🏗️ Integration with POSII

The POSII system automatically sends kitchen orders to:
```
http://127.0.0.1:3001/print/kitchen
```

**The helper app must be running before using POSII printing features.**

## 📝 Version History

- **v1.1.0** - Added actual thermal printing with EPSON TM-T20III support
- **v1.0.0** - Initial HTTP server with mock printing

## 🆘 Support

If you experience issues:
1. Check the console output for errors
2. Test the `/health` endpoint
3. Try the `/print/test` endpoint
4. Contact support with the error logs

---
**Cottage Tandoori Restaurant Management System**
