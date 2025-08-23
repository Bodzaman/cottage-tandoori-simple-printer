# Cottage Tandoori Rich Template Printer

A powerful, Windows-first thermal printing solution with rich template processing capabilities for Cottage Tandoori restaurant. Integrates seamlessly with ThermalReceiptDesigner for advanced receipt formatting with images, QR codes, and custom fonts.

## 🎯 Why This Solution?

This enhanced printer helper eliminates "No driver set!" errors while providing **rich template processing** capabilities:
- **Rich Templates**: Full ThermalReceiptDesigner integration with images, QR codes, custom fonts
- **ESC/POS Commands**: Native thermal printer command generation for perfect formatting
- **Windows Integration**: Leverages Windows print spooler for reliable printing
- **Backward Compatible**: Works with existing simple text printing workflows

Perfect for restaurants using:
- Epson TM-T20III Receipt Printers
- Epson TM-T88V Receipt Printers  
- Any Windows-configured thermal printer

## ✨ Rich Template Features

### 🎨 ThermalReceiptDesigner Integration
- **Business Branding**: Logo placement with thermal optimization
- **QR Code Support**: Header and footer QR codes with size/position control
- **Custom Fonts**: Professional font rendering for headers and items
- **Template Assignment**: Automatic template selection based on order type
- **Visual Preview**: WYSIWYG design matching printed output

### 🖼️ Image Processing
- **Logo Optimization**: Automatic thermal printer optimization with dithering
- **QR Code Generation**: Dynamic QR codes for WiFi, URLs, contact info
- **Floyd-Steinberg Dithering**: Perfect black/white conversion for thermal printing
- **Size Optimization**: Smart resizing for 58mm and 80mm thermal paper

### 📟 ESC/POS Command Generation
- **Native Commands**: Direct ESC/POS command generation for perfect formatting
- **Font Control**: Bold, underline, size, and alignment commands
- **Image Printing**: Bitmap conversion for logos and QR codes
- **Paper Cutting**: Automatic cut commands for clean receipts

## 🚀 Quick Start

1. **Download the latest release** from the releases page
2. **Ensure your thermal printer is configured in Windows**
3. **Run the enhanced printer helper**:
   ```bash
   ./cottage-tandoori-printer.exe
   ```
4. **Test rich template printing**:
   ```bash
   curl -X POST http://localhost:3001/print/test
   ```

## 🖨️ Enhanced Endpoints

### Health Check with Capabilities
```bash
GET http://localhost:3001/health
# Returns version, features, and capabilities

GET http://localhost:3001/capabilities  
# Detailed feature and format support information
```

### Rich Template Printing (NEW)
```bash
POST http://localhost:3001/print/template
Content-Type: application/json

{
  "template_data": {
    "business_name": "Cottage Tandoori",
    "address": "123 Restaurant Street, City",
    "phone": "+44 20 1234 5678",
    "logo_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...",
    "logo_position": "center",
    "header_qr_codes": [
      {
        "id": "wifi_qr",
        "content": "WIFI:T:WPA;S:RestaurantWifi;P:password123;;",
        "size": "medium",
        "position": "center",
        "enabled": true
      }
    ],
    "receipt_number": "R2024001",
    "order_date": "2024-08-23",
    "customer_name": "John Smith",
    "order_type": "collection",
    "footer_message": "Thank you for dining with us!",
    "footer_qr_codes": [
      {
        "id": "feedback_qr", 
        "content": "https://cottage-tandoori.com/feedback",
        "size": "small",
        "position": "center",
        "enabled": true
      }
    ]
  },
  "items": [
    {
      "name": "Chicken Tikka Masala",
      "quantity": 2,
      "price": 12.95
    }
  ]
}
```

### Kitchen Ticket (Enhanced)
```bash
POST http://localhost:3001/print/kitchen
Content-Type: application/json

{
  "template_data": { /* ThermalReceiptData format */ },
  "orderNumber": "K001",
  "orderType": "DINE-IN", 
  "items": [
    {
      "name": "Chicken Tikka Masala",
      "quantity": 2,
      "modifiers": [{"name": "Extra Spicy"}],
      "specialInstructions": "No onions"
    }
  ],
  "specialInstructions": "Table 5 - Rush order"
}
```

### Customer Receipt (Enhanced)
```bash
POST http://localhost:3001/print/receipt
Content-Type: application/json

{
  "template_data": { /* Rich template data */ },
  "orderNumber": "R001",
  "orderType": "COLLECTION",
  "items": [
    {
      "name": "Lamb Curry", 
      "quantity": 1,
      "price": 12.95
    }
  ]
}
```

## 🎨 ThermalReceiptDesigner Integration

The printer helper integrates directly with the ThermalReceiptDesigner template system:

### Template Assignment Workflow
1. **Design Templates**: Use ThermalReceiptDesigner to create rich receipt templates
2. **Assign Templates**: Configure which templates to use for different order scenarios
3. **Automatic Selection**: POSII system automatically selects appropriate templates
4. **Live Printing**: Templates print with full rich formatting

### Supported Template Elements
- **Business Information**: Name, address, phone, email, VAT number
- **Logo Images**: Automatic thermal optimization and positioning
- **QR Codes**: WiFi, URLs, contact cards, custom content
- **Order Details**: Dynamic order information insertion
- **Custom Fonts**: Professional typography for different sections
- **Layout Control**: Precise positioning and alignment

## 🔧 Configuration

The enhanced helper automatically detects and uses thermal printers:
1. **EPSON TM-T20III Receipt** (preferred)
2. **EPSON TM-T88V Receipt** (backup)
3. Any Epson thermal printer
4. First available printer

### Rich Template Settings
- **Paper Width**: Auto-detect 58mm or 80mm thermal paper
- **Image Dithering**: Floyd-Steinberg algorithm for optimal thermal printing
- **QR Code Sizes**: Small (100px), Medium (150px), Large (200px)
- **Font Rendering**: Canvas-based font rendering with thermal optimization

## 📋 Requirements

- **Windows 10/11** (required)
- **Thermal printer configured in Windows**
- **Node.js 20+** (for development)
- **ThermalReceiptDesigner** (for template creation)

## 🛠️ Development

```bash
# Install dependencies (includes rich template packages)
npm install

# Start development server
npm start

# Build executable with rich template support
npm run build

# Test rich template printing
npm run test
```

## 🎯 Integration Points

### With Cottage Tandoori Platform
1. **ThermalReceiptDesigner**: Visual template creation and editing
2. **Template Assignment API**: Dynamic template selection system
3. **POSII Integration**: Automatic template-driven printing
4. **Real-time Preview**: Template preview matches printed output
5. **Performance Optimization**: Template caching and optimization

### Template Data Flow
```
POSII Order → Template Assignment → Rich Template Data → ESC/POS Commands → Thermal Printer
```

## 📊 Performance & Capabilities

### Performance Metrics
- **Startup**: < 3 seconds (includes rich template initialization)
- **Simple Print**: 200ms average per job
- **Rich Template**: 500ms average (includes image processing)
- **Memory Usage**: < 100MB (includes image processing buffers)
- **CPU Usage**: < 2% idle, < 10% during rich template processing

### Rich Template Capabilities
- **Image Processing**: JPEG, PNG, WebP support with thermal optimization
- **QR Code Generation**: All standard QR code types with error correction
- **Font Rendering**: TrueType font support with thermal-optimized sizing
- **ESC/POS Commands**: Full command set for Epson thermal printers
- **Template Caching**: Smart caching for improved performance

## 🔍 Troubleshooting

### Rich Template Issues

#### "Template processing failed"
- Verify template data format matches ThermalReceiptData schema
- Check image data is valid base64 encoded
- Ensure QR code content is properly formatted

#### "Image processing error"
- Verify image format is supported (JPEG, PNG, WebP)
- Check image size is reasonable (< 5MB)
- Ensure sufficient memory for image processing

#### "QR code generation failed"
- Verify QR content is valid for the specified type
- Check QR content length is within limits
- Ensure QR size is supported (small, medium, large)

### Traditional Issues

#### "No printers available"
- Ensure thermal printer is installed in Windows
- Check printer is online and ready
- Verify printer name matches expected format

#### "Print failed" errors
- Check Windows print spooler service is running
- Ensure printer has paper and is ready
- Try test print from Windows printer properties

## 🔐 Security

- **Local HTTP server only** (no external access)
- **Template data validation** (prevents malicious content)
- **Image processing sandbox** (safe image handling)
- **Windows print spooler security** (leverages OS security)
- **Temporary file cleanup** (automatic cleanup)

## 📈 Version History

### v3.0.0 - Rich Template Integration
- ✨ Full ThermalReceiptDesigner integration
- 🖼️ Image processing with thermal optimization
- 📱 QR code generation and positioning
- 🔤 Custom font rendering
- 📟 ESC/POS command generation
- 🔄 Backward compatibility maintained

### v2.0.0 - Windows-First Approach
- 🔧 Windows print spooler integration
- 📄 Simple text formatting
- 🖨️ Reliable thermal printing

## 📞 Support

For technical support:
- **ThermalReceiptDesigner Issues**: Check template format and design
- **Printing Issues**: Verify Windows printer configuration
- **Integration Issues**: Contact Cottage Tandoori development team
- **Bug Reports**: [GitHub Issues](https://github.com/Bodzaman/cottage-tandoori-simple-printer/issues)

## 🔗 Related Projects

- **ThermalReceiptDesigner**: Visual template designer for rich receipts
- **POSII Integration**: Restaurant POS system with template assignment
- **Cottage Tandoori Platform**: Complete restaurant management system

## 📜 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for Cottage Tandoori Restaurant**  
**Rich Template Processing Powered by ThermalReceiptDesigner Integration**
