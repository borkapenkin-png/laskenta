# PDF Takeoff & Cost Estimation App - PRD

## Original Problem Statement
Build a modern, 100% client-side, browser-based PDF takeoff and cost estimation application for a Finnish painting, plastering, and facade company (J&B Tasoitusmaalaus Oy).

## Core Requirements
- **Architecture:** No backend, no server, no user accounts. All logic is client-side.
- **Storage:** Use `localStorage` for autosaving and allow project import/export as `.json` files.
- **Language:** Finnish UI, user communicates in Finnish/Estonian mix.

## Implemented Features

### Core PDF & Measurement Tools
- ✅ Open and view multi-page PDF floor plans
- ✅ Scale calibration (manual and two-point)
- ✅ Measurement tools: Length (jm), Area (m²), Count (kpl)
- ✅ Wall measurement with openings deduction
- ✅ Context-sensitive preset system with predefined work items and prices

### Preset System
- ✅ Maalaus (painting) presets for walls, ceilings
- ✅ Tasoitus (plastering) presets
- ✅ Märkätila (wet room) presets
- ✅ Kipsirakenteet (drywall construction) presets
- ✅ Pystykotelot (vertical casings) presets
- ✅ Unified naming convention across all presets

### Offer Generation ("Tee tarjous")
- ✅ Two input modes: "Laskennasta" (automatic) and "Käsin" (manual entry)
- ✅ Professional PDF template with company branding
- ✅ Configurable VAT logic (ALV 0% vs. incl. ALV 25.5%)
- ✅ Material overhead percentage for change orders
- ✅ Offer author selector (Boris Penkin / Joosep Rohusaar)
- ✅ Robust pagination preventing text overlap
- ✅ Professional terms (YSE 1998 & MaalausRYL 2012)

### Summary Offer ("Koontitarjous") - COMPLETED 2025-03-02
- ✅ Upload multiple project JSON files
- ✅ Parse and validate project data
- ✅ Merge identical operations (same label + unit + price)
- ✅ Generate consolidated PDF with same template as "Tee tarjous"
- ✅ Customer info, offer details, pricing options

### Undo/Redo Functionality - COMPLETED 2025-03-02
- ✅ Undo/Redo buttons in toolbar with keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
- ✅ Save state before: adding, updating, deleting, copying measurements
- ✅ Works with all measurement operations

### Project Management
- ✅ Save/Load projects as JSON (includes embedded PDF)
- ✅ Autosave to localStorage
- ✅ Project naming

## Technical Stack
- **Framework:** React.js (Create React App)
- **PDF Rendering:** pdf.js
- **PDF Generation:** jspdf, jspdf-autotable
- **UI Components:** Shadcn/UI, Lucide icons
- **State:** React Hooks (useState, useEffect)
- **Storage:** Client-side localStorage

## File Structure
```
/app/frontend/src/
├── App.js                    # Main stateful component
├── components/
│   ├── KoontitarjousDialog.js  # Summary offer from multiple JSONs
│   ├── TarjousDialog.js        # Single offer generation
│   ├── ToolPresetSelector.js   # Preset selection UI
│   ├── TakeoffPanel.js         # Measurement list panel
│   ├── PDFViewer.js            # PDF display component
│   └── ...
├── utils/
│   ├── export.js               # PDF generation functions
│   └── storage.js              # localStorage helpers
└── constants/
    └── company.js              # Company info, terms
```

## Backlog

### P2 - Nice to Have
- [ ] Preset configuration UI (create/edit presets in app)
- [ ] Export to CSV improvements
- [ ] Multi-language support

### P3 - Future
- [ ] Cloud sync option
- [ ] Team collaboration features
- [ ] Invoice generation

## Known Issues
- Minor: DialogContent missing aria-describedby (accessibility warning, doesn't affect functionality)
- User dismissed: Left sidebar thumbnail rendering issue - not a priority

## Testing
- Test files: `/tmp/test_projects/projekt1.json`, `/tmp/test_projects/projekt2.json`
- Test report: `/app/test_reports/iteration_8.json`
- All features verified working 2025-03-02

## Notes for Development
- All changes are client-side only
- Project JSON must include embedded PDF base64 for full restoration
- VAT is always 25.5% in Finland
- Prices are stored as ALV 0% internally
