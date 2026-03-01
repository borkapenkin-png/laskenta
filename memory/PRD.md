# PDF Takeoff & Cost Estimation App - PRD

## Original Problem Statement
Browser-based PDF takeoff and cost estimation application for a Finnish painting, plastering, and facade company. 100% client-side with no backend required.

## Core Requirements
- **Architecture:** Pure client-side React app, no server or database
- **Storage:** localStorage for autosaving + JSON import/export
- **PDF:** View multi-page PDF floor plans with zoom and pan
- **Measurement Tools:** Length (jm), Area (m²), Count (kpl), Wall tool (jm → m²)
- **Cost Calculation:** Prices per unit, totals with VAT
- **Export:** CSV and PDF reports (with prices / quantities only)

## Target Users
Finnish painting/plastering companies who need to:
- Open PDF floor plans
- Take measurements directly on the PDF
- Calculate labor and material costs
- Generate quotes/reports

## UI Structure
- Top toolbar: Tools + file operations + 2 PDF export buttons
- Left sidebar: Project name input + PDF page thumbnails (collapsible)
- Center: PDF viewer with measurement overlay
- Right panel: Takeoff list with grouped summary, Calculator (collapsible)

---

## Implemented Features (March 2026)

### Core Features
- [x] PDF loading and rendering (pdf.js)
- [x] PDF zoom controls (+ / - buttons, Ctrl+scroll)
- [x] PDF page navigation
- [x] PDF panning (Hand tool)
- [x] Collapsible left sidebar with thumbnails
- [x] Collapsible right panel (Määrälaskenta, Laskenta tabs)
- [x] Project name input field (left sidebar top)

### Measurement Tools
- [x] Line tool (jm)
- [x] Rectangle tool (m²)
- [x] Polygon tool (m²)
- [x] Wall tool (jm → m² with height)
- [x] Count tool (kpl)
- [x] Snap to 45° angles (hold Shift)

### Preset System
- [x] Contextual preset dropdown (appears when tool selected)
- [x] No prices shown in dropdown (clean UI)
- [x] Change preset type in edit mode (Tyyppi dropdown)
- [x] Complex presets with sub-settings (Kuivatila, Märkätila, PRH)
- [x] Ranka/Kipsi options for construction types

### Measurement Management
- [x] Selection from list (orange highlight)
- [x] Delete via toolbar button / row trash icon / keyboard
- [x] Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- [x] Copy measurement with edit capability
- [x] Jalkalista (baseboard) button for wall measurements

### Cost Calculation
- [x] Price per unit calculation
- [x] VAT calculation (configurable %)
- [x] Per-measurement breakdown
- [x] **Grouped summary by type** (Yhteenveto tyypeittäin)

### Data Persistence
- [x] Auto-save to localStorage
- [x] **Save project as JSON** (Tallenna button)
- [x] **Load project from JSON** (Lataa button)

### Export Features
- [x] CSV export with grouped data
- [x] **PDF export with prices** (PDF € button)
- [x] **PDF export quantities only** (PDF button - for subcontractors)
- [x] Same measurement types grouped in exports

### Settings
- [x] VAT percentage (ALV %)
- [x] **Global wall height** - changes all walls when updated
- [x] Helper text: "Muuttaa kaikkien seinien korkeuden"

---

## Bug Fixes (March 2026)

### Fixed in Previous Sessions
1. Right Panel Empty After Toggle
2. PDF Panning Not Working
3. Measurement Deletion Not Working
4. Zoom & Scale Inaccuracy - coordinates normalized to zoom=1.0

### Fixed in This Session
- Toolbar duplicate line removed
- Preset dropdown shows only names (no prices)
- "Kustannukset" renamed to "Yhteenveto" everywhere

### Fixed (December 2025)
- **Määrälaskenta UI changes:**
  - Removed prices from measurement list items (hinnat poistettu mittauslistasta)
  - Action buttons (copy, edit, delete) always visible with flex-shrink-0
  - Long description text truncates with ellipsis
  - Added data-testid attributes for testing

---

## Technical Architecture

```
/app/frontend/src/
├── App.js                    # Main state, handlers
├── components/
│   ├── Toolbar.js            # Top toolbar + 2 PDF buttons
│   ├── PDFViewer.js          # PDF canvas + controls
│   ├── MeasurementOverlay.js # Drawing canvas
│   ├── TakeoffPanel.js       # Measurement list + grouped summary
│   ├── CalculatorPanel.js    # Cost calculations + global height
│   ├── LeftSidebar.js        # Project name + page thumbnails
│   ├── CalibrateDialog.js    # Scale calibration
│   └── ToolPresetSelector.js # Contextual preset dropdown
├── utils/
│   ├── geometry.js           # Math calculations
│   ├── hitTesting.js         # Click detection
│   ├── storage.js            # localStorage + JSON export/import
│   ├── export.js             # CSV/PDF export with grouping
│   └── pdfHelpers.js         # PDF utilities
└── hooks/
    └── use-toast.js          # Toast notifications
```

## Key Data Model

```javascript
Measurement {
  id: string,
  type: 'line' | 'rectangle' | 'polygon' | 'wall' | 'count',
  label: string,
  unit: 'jm' | 'm²' | 'kpl',
  quantity: number,
  pricePerUnit: number,
  points: [{x, y}],
  wallHeight?: number,
  bothSides?: boolean,
  openings?: number,
  // Special type flags
  isPystykotelot?: boolean,
  isKuivatilaRakennus?: boolean,
  isPRHRakennus?: boolean,
  isKuivatilaAK?: boolean,
  isMarkatilaAK?: boolean,
  isPRHAK?: boolean,
  // Construction options
  rankaType?: 'metall' | 'kertapuu',
  kipsiType?: '1-kertainen' | '2-kertainen',
  lagiPaneeli?: boolean,
  page: number
}

Project {
  id: string,
  name: string,
  measurements: Measurement[],
  scale: object | null,
  createdAt: string,
  updatedAt: string
}
```

---

## Upcoming Tasks (P1)

### User Testing
- [ ] User will test all features: Save/Load, PDF Exports, Global Height, Offer Generation, Zoom fix
- [ ] Wait for user feedback before starting new features

### Left Sidebar Thumbnails
- [ ] Verify thumbnails render after collapse/expand (known issue from initial handoff)
- ResizeObserver implementation exists - may need further testing

### Further Tool Refinements
- [ ] User wants to go through each tool one by one

---

## Future Tasks (P2)

### Advanced Measurement
- [ ] Select measurement on canvas
- [ ] Edit measurement points
- [ ] Measurement labels on canvas

### UI Polish
- [ ] Loading indicators
- [ ] Better error messages
- [ ] Keyboard shortcuts help

### Preset Management
- [ ] Allow user to create/edit custom presets
- [ ] Save presets to localStorage
