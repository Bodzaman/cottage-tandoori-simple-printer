
# 🖨️ Cottage Tandoori Raw ESC/POS Printer Helper v2.0.0

**Direct thermal printing using raw ESC/POS commands - No thermal libraries!**

## ✨ What's Different

- ❌ **No thermal libraries** (node-thermal-printer removed)
- ✅ **Raw ESC/POS commands** sent directly to printer
- ✅ **Windows PowerShell** integration for reliable printing
- ✅ **File-based fallback** for cross-platform support
- ✅ **Proper thermal formatting** with cuts, bold text, alignment

## 🚀 Quick Start

### Windows (Recommended)
1. Download `printer-helper-win.exe`
2. Double-click to run
3. Connect TM-T20III via USB
4. Test at `http://localhost:3001`

### macOS
1. Download `printer-helper-macos`
2. Terminal: `chmod +x printer-helper-macos && ./printer-helper-macos`

### Linux
1. Download `printer-helper-linux`
2. Terminal: `chmod +x printer-helper-linux && ./printer-helper-linux`

## 🔧 How It Works

**Raw ESC/POS Implementation:**
```javascript
// Initialize printer
ESC + '@'                    // Reset printer
ESC + 'a' + chr(1)          // Center align
ESC + '!' + chr(48)         // Double size text
"COTTAGE TANDOORI" + LF     // Header
GS + 'V' + chr(65) + chr(0) // Cut paper
```

**Windows Printing Methods:**
1. **PowerShell + .NET PrintDocument** (Primary)
2. **COPY command to printer port** (Fallback)

**Cross-Platform Fallback:**
- Temporary file → lp command (macOS/Linux)
- Raw binary data transfer

## 📡 API Endpoints

```bash
# Health check
GET http://localhost:3001/health

# Print kitchen ticket
POST http://localhost:3001/print-receipt
{
  "order_data": {
    "order_id": "001",
    "order_type": "DINE-IN",
    "items": [
      {
        "quantity": 2,
        "name": "Chicken Tikka",
        "modifiers": ["Extra Spicy"],
        "special_instructions": "No onions"
      }
    ]
  }
}

# Test print
POST http://localhost:3001/test-print

# Printer status
GET http://localhost:3001/printer-status
```

## 🎯 Kitchen Ticket Format

```
        COTTAGE TANDOORI

ORDER #: 001
TYPE: DINE-IN
TIME: 14:30:25

================================
2x Chicken Tikka
  + Extra Spicy
  NOTE: No onions

================================
            KITCHEN COPY


[CUT]
```

## 🛠️ Development

```bash
npm install
npm start        # Run development server
npm run build    # Build executables
npm test         # Test mode
```

## 🔍 Troubleshooting

**Windows:**
- Ensure TM-T20III is set as default printer
- Check Windows printer drivers
- Run as Administrator if needed

**No Printer Found:**
- Verify USB connection
- Check printer name contains "TM-T20" or "Epson"
- Try different USB port

**Print Quality:**
- Paper width: 80mm
- Character encoding: UTF-8
- Line spacing: 24-30 dots

---

**Version 2.0.0** - Raw ESC/POS Implementation  
**No thermal libraries** - Direct printer communication only
