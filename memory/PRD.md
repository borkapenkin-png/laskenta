# PDF Takeoff & Cost Estimation App - PRD

## Original Problem Statement
Browser-based PDF takeoff and cost estimation application for a Finnish painting, plastering, and facade company. 100% client-side with no backend required.

## Core Requirements
- **Architecture:** Pure client-side React app, no server or database
- **Storage:** localStorage for autosaving + JSON import/export
- **PDF:** View multi-page PDF floor plans with zoom and pan
- **Measurement Tools:** Length (jm), Area (m²), Count (kpl), Wall tool (jm → m²)
- **Cost Calculation:** Labor hours, material costs, totals with VAT
- **Export:** CSV and PDF reports

## Target Users
Finnish painting/plastering companies who need to:
- Open PDF floor plans
- Take measurements directly on the PDF
- Calculate labor and material costs
- Generate quotes/reports

## UI Structure
- Top toolbar: Tools + file operations
- Left sidebar: PDF page thumbnails (collapsible)
- Center: PDF viewer with measurement overlay
- Right panel: Takeoff list, Presets, Calculator (collapsible)

---

## Implemented Features (Feb 2026)

### Core Features
- [x] PDF loading and rendering (pdf.js)
- [x] PDF zoom controls (+ / - buttons, Ctrl+scroll)
- [x] PDF page navigation
- [x] PDF panning (left mouse when no tool selected)
- [x] Collapsible left sidebar with thumbnails
- [x] Collapsible right panel (Takeoff, Presets, Calculator tabs)

### Measurement Tools
- [x] Line tool (jm)
- [x] Rectangle tool (m²)
- [x] Polygon tool (m²)
- [x] Wall tool (jm → m² with height)
- [x] Count tool (kpl)
- [x] Snap to 45° angles (hold Shift)

### Measurement Management
- [x] Selection from list (orange highlight)
- [x] Delete via toolbar button
- [x] Delete via row trash icon
- [x] Delete via keyboard (Delete/Backspace)
- [x] Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- [x] Clear page measurements
- [x] Clear all project measurements

### Cost Calculation
- [x] Labor hours calculation
- [x] Material cost calculation
- [x] VAT calculation
- [x] Per-measurement breakdown

### Data Persistence
- [x] Auto-save to localStorage
- [x] Save/Load project as JSON
- [x] Demo measurements on startup

---

## Bug Fixes (Feb 28, 2026)

### Fixed in This Session
1. **Right Panel Empty After Toggle** - Changed from `width:0 + overflow:hidden` to `margin-right` transition
2. **PDF Panning Not Working** - Added left mouse panning when no tool selected
3. **Measurement Deletion Not Working** - Fixed selection from list and delete button functionality

---

## Upcoming Tasks (P1)

### Left Sidebar Thumbnails
- [ ] Verify thumbnails render after collapse/expand
- [ ] Test with multi-page PDF

### Scale Calibration
- [ ] Auto-detect scale from PDF text
- [ ] Manual two-point calibration tool
- [ ] Scale indicator display

### Preset System
- [ ] Create/edit/delete presets
- [ ] Apply preset to new measurements
- [ ] Import/export presets

---

## Future Tasks (P2)

### Export Features
- [ ] CSV export with full calculation breakdown
- [ ] PDF report generation with measurements

### Advanced Measurement
- [ ] Select measurement on canvas (requires points data)
- [ ] Edit measurement points
- [ ] Measurement labels on canvas

### UI Polish
- [ ] Loading indicators
- [ ] Better error messages
- [ ] Keyboard shortcuts help

---

## Technical Architecture

```
/app/frontend/src/
├── App.js                    # Main state, handlers
├── components/
│   ├── Toolbar.js            # Top toolbar
│   ├── PDFViewer.js          # PDF canvas + controls
│   ├── MeasurementOverlay.js # Drawing canvas
│   ├── TakeoffPanel.js       # Measurement list
│   ├── CalculatorPanel.js    # Cost calculations
│   ├── PresetPanel.js        # Preset management
│   ├── LeftSidebar.js        # Page thumbnails
│   └── CalibrateDialog.js    # Scale calibration
├── utils/
│   ├── geometry.js           # Math calculations
│   ├── hitTesting.js         # Click detection
│   ├── storage.js            # localStorage helpers
│   ├── export.js             # CSV/PDF export
│   └── pdfHelpers.js         # PDF utilities
└── hooks/
    └── use-toast.js          # Toast notifications
```

## Key Data Model

```javascript
Measurement {
  id: string,
  type: 'line' | 'rectangle' | 'polygon' | 'wall' | 'count',
  category: string,
  subcategory: string,
  unit: 'jm' | 'm²' | 'kpl',
  quantity: number,
  points: [{x, y}],
  wallHeight?: number,
  bothSides?: boolean,
  openings?: number,
  waste: number,
  layers: number,
  productivity: number,
  materialCostPerUnit: number,
  page: number
}
```
