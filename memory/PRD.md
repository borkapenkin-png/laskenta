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

### Maksuerätaulukko (Payment Schedule) - COMPLETED 2025-03-02
- ✅ Standalone utility module with dedicated full-page view
- ✅ Input: Urakkasumma (contract amount), ALV mode, Preset selector
- ✅ Presets: YSE-6 (balanced), YSE-8 (detailed), 10-80-10 (valmisaste), Custom
- ✅ 10-80-10 with configurable milestone count (4, 5, or 6 intermediate payments)
- ✅ Custom tab for manual row editing with add/delete/normalize
- ✅ Validation: % must sum to 100% with visual warnings
- ✅ Copy to clipboard (formatted text for email)
- ✅ PDF export with same Tarjous styling (company logo, teal accent, same fonts)
- ✅ Rounding rules: display 2 decimals, last row adjusted for exact total
- ✅ localStorage persistence for last used values

### Project Management
- ✅ Save/Load projects as JSON (includes embedded PDF)
- ✅ Autosave to localStorage
- ✅ Project naming

### Responsive Toolbar - COMPLETED 2025-03-02
- ✅ Breakpoint-based responsive design (1200px, 950px)
- ✅ Left group: File operations (icon-only on narrow screens)
- ✅ Middle group: Tools with horizontal scroll if needed
- ✅ Right group: Primary action always visible + overflow menu
- ✅ "Lisää" dropdown menu for secondary actions (Koontitarjous, Maksuerätaulukko, Vie PDF)
- ✅ No buttons cut off at any viewport width
- ✅ Hidden scrollbar for clean appearance

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
├── App.js                         # Main stateful component
├── components/
│   ├── MaksuerataulukkoPage.js    # Payment schedule utility (NEW)
│   ├── KoontitarjousDialog.js     # Summary offer from multiple JSONs
│   ├── TarjousDialog.js           # Single offer generation
│   ├── ToolPresetSelector.js      # Preset selection UI
│   ├── TakeoffPanel.js            # Measurement list panel
│   ├── PDFViewer.js               # PDF display component
│   ├── Toolbar.js                 # Top navigation bar
│   └── ...
├── utils/
│   ├── export.js                  # Tarjous/Koontitarjous PDF functions
│   ├── maksuerataulukko-export.js # Payment schedule PDF (NEW)
│   └── storage.js                 # localStorage helpers
└── constants/
    └── company.js                 # Company info, terms
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
- Test reports: `/app/test_reports/iteration_8.json`, `/app/test_reports/iteration_9.json`, `/app/test_reports/iteration_10.json`, `/app/test_reports/iteration_11.json`
- All features verified working 2025-03-03

## Completed: Rakennus Options Unification - 2025-03-03
- ✅ Removed configuration options (Karkass, Villa, Kipsi) from ToolPresetSelector modal
- ✅ "Rakennus" type presets now create measurements with default options immediately
- ✅ Added unified ConstructionOptionsEditor in TakeoffPanel for editing options
- ✅ Price recalculation works when options are changed
- ✅ Label auto-updates based on selected options
- ✅ All 6 tests passed in iteration_10

## Bug Fix: Totals Sync Between Panels - 2025-03-03
- ✅ Fixed TakeoffPanel.calculateRow() to use effectiveQuantity for cost calculation
- ✅ Wall measurement totals now correctly use: (quantity × wallHeight × bothSidesFactor) - openings
- ✅ Määrälaskenta and Laskenta tabs now show identical totals
- ✅ All 5 tests passed in iteration_11

## Bug Fix: PDF Annotation Labels Showing Wrong Values - 2025-03-03
- ✅ Fixed MeasurementOverlay.js to calculate effectiveM² for wall type measurements
- ✅ PDF annotation labels now show calculated m² instead of raw jm for wall measurements
- ✅ Labels on PDF now match values shown in TakeoffPanel
- ✅ All 4 tests passed in iteration_12

## Settings Panel (Asetukset) with MongoDB - 2025-03-17
- ✅ Backend CRUD: GET/PUT /api/presets/tools, GET/PUT /api/presets/maksuera, POST /api/presets/reset
- ✅ All presets stored in MongoDB (replaced localStorage)
- ✅ Settings dialog loads from API, saves to API
- ✅ Fixed "Muu" custom preset: BOTH name AND price input (was price=0 bug)
- ✅ Preset list shows prices next to names
- ✅ Add/Edit/Delete/Restore fully functional
- ✅ 26 tests passed (10 backend + 16 frontend) - iteration_16

## AI Room Detection - REMOVED 2025-03-17
- Removed: SAM 3 and flood fill approaches both had issues with floor plans
- Feature was removed per user request

## Work Schedule Generator (Töögraafik) - 2025-03-17 → 2025-03-18
- ✅ Backend API: GET/PUT /api/presets/tes-prices for TES unit prices
- ✅ **Logic Change:** Productivity is calculated from TES prices: `rate = hourlyTarget / price`
- ✅ Default hourly target: 18€/h (configurable)
- ✅ 21 default TES prices across 7 categories
- ✅ Three dialog variants:
  - **Työaikataulu:** Project-based schedule from current measurements
  - **Oma työaikataulu:** Custom schedule builder with TES prices
  - **Koonti työaikataulu:** Summary schedule from multiple project JSON files
- ✅ PDF export with Gantt chart and "Huom:" notes section for all variants
- ✅ Unified PDF format across all three variants (2025-03-18)
- ✅ Toolbar refactored: "Laskelmat" dropdown menu groups all schedule options

## Custom TES Price Integration - 2025-03-18
- ✅ New API: POST /api/presets/tes-prices/add-custom
- ✅ When user creates a "Muu" (custom) work item via ToolPresetSelector, it's automatically added to TES prices
- ✅ New custom items default to price = 0€ (user should update in Settings → TES hinnat)
- ✅ Duplicate detection prevents adding the same item twice
- ✅ Cleaned up: removed unused `fal_client` dependency from requirements.txt

## Offer Terms Editor (Tarjouksen ehdot) - 2025-03-18
- ✅ New API endpoints: GET/PUT /api/presets/offer-terms, POST /api/presets/offer-terms/reset
- ✅ New OfferTermsEditor component with full CRUD:
  - Add new terms
  - Edit existing terms (click to edit)
  - Delete terms
  - Drag & drop to reorder
  - Reset to defaults
- ✅ Accessible via Tarjous dropdown → "Tarjouksen ehdot"
- ✅ Terms saved to MongoDB, loaded for PDF export
- ✅ exportTarjousPDF and exportKoontitarjousPDF updated to use custom terms

## Work Schedule PDF as Official Document (Työmääräerittely) - 2025-03-18
- ✅ Refactored all three work schedule PDF exports to official document format:
  - **Title:** TYÖMÄÄRÄERITTELY (not TYÖAIKATAULU)
  - **Subtitle:** "Liite urakkasopimukseen"
  - **Regulatory references box:** TES, MaalausRYL 2012, Työturvallisuuslaki (738/2002)
  - **Removed:** YSE 1998 (company-to-company), Arvioitu kesto (estimated duration), Gantt chart
  - **Added:** Y-tunnus in header, company address in footer
  - **Summary:** Shows total hours + hours per worker (no days/weeks)
  - **Disclaimer:** Clear note that estimates may vary
- ✅ Same format for all three variants: Työaikataulu, Oma työaikataulu, Koonti työaikataulu
- ✅ Filename changed to "Tyomaaraerittely_..." for clarity

## Resend Email Integration (Tarjous sähköpostilla) - 2025-12-20
- ✅ Backend API: POST /api/send-tarjous-email - sends emails with PDF attachment via Resend
- ✅ Professional HTML email template with:
  - Company logos (J&B logo + Suomen Vahvimmat)
  - Gradient header
  - Dynamic sender signature from yhteyshenkilö field
  - Company contact info footer (Y-tunnus, address, phone, email)
- ✅ TarjousDialog: "Lähetä tarjous" button sends generated PDF directly to customer email
- ✅ KoontitarjousDialog: Same email functionality synchronized
- ✅ Email requires: recipient_email, subject, body_text, pdf_base64, pdf_filename
- ✅ Optional sender_name for personalized signature
- ✅ Frontend generates PDF as base64 → sends to backend → backend calls Resend API
- ✅ Toast notifications for success/failure
- ✅ All 11 backend tests + all frontend tests passed (iteration_20)

## Notes for Development
- All changes are client-side only
- Project JSON must include embedded PDF base64 for full restoration
- VAT is always 25.5% in Finland
- Prices are stored as ALV 0% internally
- Maksuerätaulukko works independently (no project needed)
