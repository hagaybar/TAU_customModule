# Manual Setup Plan: CenLib Map MDM Integration

This document outlines the manual steps required to complete the Multi-Dimensional Mapping (MDM) integration for the CenLib Map feature.

## Overview

The code implementation is complete. The remaining work involves:
1. Mapping shelf IDs to call number ranges
2. Setting up the Google Sheet with mapping data
3. Configuring the library settings

---

## Phase 1: Shelf ID to Visual Label Mapping

### Goal
Create a reference document that maps SVG shelf IDs (e.g., `shelf_path114_050`) to the visible labels on the map (e.g., "55").

### Steps

1. **Open the SVG in a browser**
   ```
   Open: src/app/custom1-module/cenlib-map/shelf-map-svg/s_map_test_p2_shelves_split.svg
   ```

2. **Use browser DevTools to identify shelves**
   - Right-click on a shelf → Inspect
   - Note the element ID (e.g., `shelf_path114_050`)
   - Note the corresponding visual label from the map (e.g., "55")

3. **Create a mapping table**
   Create a spreadsheet or document with columns:
   | shelf_id | visual_label | section | notes |
   |----------|--------------|---------|-------|
   | shelf_path114_050 | 55 | Top row | Near label "55" |
   | shelf_path114_048 | 50 | Top row | Near label "50" |
   | ... | ... | ... | ... |

4. **Key sections to map** (based on visible labels in the map):
   - **Top row (CC/CCG)**: 1-4, 5-12, 13-16, 17-26, 27-34, 35-46
   - **Second row**: 36, 40, 45, 50, 55, 60, 65, 70
   - **Left side**: 12, 13, 19, 20, 25, 30, 35
   - **Right side**: 75, 80, 84, 90, 95, 100, 105, CL

### Deliverable
A reference document: `docs/referencehe/slf_id_mapping.csv`

---

## Phase 2: Google Sheet Setup

### Goal
Create a Google Sheet with shelf mapping data that the application will fetch.

### Steps

1. **Create a new Google Sheet**
   - Go to [Google Sheets](https://sheets.google.com)
   - Create a new spreadsheet
   - Name it: "CenLib Shelf Mappings"

2. **Set up the required columns** (in this exact order):
   ```
   libraryName | locationName | rangeStart | rangeEnd | svgCode | description | descriptionHe | floor | shelfLabel | notes
   ```

3. **Column descriptions**:
   | Column | Required | Description | Example |
   |--------|----------|-------------|---------|
   | libraryName | Yes | Hebrew library name (must match Primo DOM exactly) | הספרייה למדעים מדויקים ולהנדסה |
   | locationName | Yes | Hebrew location name (must match Primo DOM exactly) | ספרי לימוד - קומת כניסה |
   | rangeStart | Yes | Start of call number range | 001 |
   | rangeEnd | Yes | End of call number range | 100 |
   | svgCode | Yes | Shelf ID from SVG | shelf_path114_050 |
   | description | Yes | English description | Computer Science |
   | descriptionHe | No | Hebrew description | מדעי המחשב |
   | floor | No | Floor number | 2 |
   | shelfLabel | No | Physical shelf label | 55 |
   | notes | No | Internal notes | |

4. **Add sample data rows**:
   ```
   הספרייה למדעים מדויקים ולהנדסה | ספרי לימוד - קומת כניסה | 001 | 100 | shelf_path114_032 | General Works | כללי | 2 | 1-4 |
   הספרייה למדעים מדויקים ולהנדסה | ספרי לימוד - קומת כניסה | 101 | 200 | shelf_path114_034 | Philosophy | פילוסופיה | 2 | 5-12 |
   ```

5. **Publish the sheet as CSV**:
   - Go to: File → Share → Publish to web
   - Select the sheet tab (not "Entire Document")
   - Choose format: "Comma-separated values (.csv)"
   - Click "Publish"
   - Copy the generated URL

6. **Update the application config**:
   - Open: `src/app/custom1-module/cenlib-map/config/google-sheets.config.ts`
   - Replace the URL in `shelfMappingsUrl` with your published CSV URL

### Deliverable
- Published Google Sheet with mapping data
- Updated `google-sheets.config.ts` with the CSV URL

---

## Phase 3: Library Configuration

### Goal
Ensure the library and location names in `library.config.ts` match the actual Primo DOM values.

### Steps

1. **Verify library names in Primo**:
   - Go to Primo NDE: https://tau.primo.exlibrisgroup.com/nde/home?vid=972TAU_INST:NDE&lang=he
   - Search for a book with physical holdings in your target library
   - Inspect the DOM element with class `.getit-library-title`
   - Copy the exact text (including spaces)

2. **Verify location names in Primo**:
   - In the same holdings view
   - Inspect the element with `[data-qa="location-sub-location"]`
   - Copy the exact text (remove trailing semicolon if present)

3. **Update library.config.ts**:
   - Open: `src/app/custom1-module/cenlib-map/config/library.config.ts`
   - Ensure `nameHe` values match exactly what you found in Primo DOM
   - Add any missing libraries or locations

### Example verification checklist:
| Config Value | Primo DOM Value | Match? |
|--------------|-----------------|--------|
| הספרייה למדעים מדויקים ולהנדסה | (check Primo) | ☐ |
| ספרי לימוד - קומת כניסה | (check Primo) | ☐ |

### Deliverable
- Verified and updated `library.config.ts`

---

## Phase 4: SVG Integration

### Goal
Configure the application to use the new SVG file.

### Steps

1. **Move SVG to assets folder**:
   ```bash
   cp src/app/custom1-module/cenlib-map/shelf-map-svg/s_map_test_p2_shelves_split.svg src/assets/maps/exact-sciences-floor-plan.svg
   ```

2. **Update library config SVG path**:
   - Open: `src/app/custom1-module/cenlib-map/config/library.config.ts`
   - Update the `svgPath` for the relevant library:
   ```typescript
   {
     nameHe: 'הספרייה למדעים מדויקים ולהנדסה',
     name: 'Exact Sciences and Engineering Library',
     svgPath: 'assets/maps/exact-sciences-floor-plan.svg',
     // ...
   }
   ```

3. **Update ShelfMapSvgComponent** (if needed):
   - The component may need modification to load external SVG files
   - Currently it uses inline SVG generation
   - This may require additional code changes (ask Claude for help)

### Deliverable
- SVG file in assets folder
- Updated library config with correct SVG path

---

## Phase 5: Testing

### Goal
Verify the complete flow works end-to-end.

### Steps

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the dev server**:
   ```bash
   npm run start:proxy
   ```

3. **Test in Primo**:
   - Navigate to a search result with holdings in your configured library/location
   - Verify the "Shelf Map" button appears
   - Click the button and verify:
     - Library name displays correctly
     - Location name displays correctly
     - Call number displays correctly
     - Map loads and shelf is highlighted

4. **Test cases**:
   | Test | Expected Result | Pass? |
   |------|-----------------|-------|
   | Button appears for configured library | Button visible | ☐ |
   | Button hidden for non-configured library | Button not visible | ☐ |
   | Dialog shows correct library name | Matches DOM | ☐ |
   | Dialog shows correct location | Matches DOM | ☐ |
   | Map displays correctly | SVG renders | ☐ |
   | Correct shelf highlighted | Red/highlighted fill | ☐ |

### Deliverable
- Completed test checklist
- Screenshots of working feature

---

## Quick Reference: File Locations

| File | Purpose |
|------|---------|
| `src/app/custom1-module/cenlib-map/config/library.config.ts` | Library/location definitions |
| `src/app/custom1-module/cenlib-map/config/google-sheets.config.ts` | Google Sheets URL |
| `src/app/custom1-module/cenlib-map/shelf-map-svg/s_map_test_p2_shelves_split.svg` | Source SVG with shelf IDs |
| `src/app/custom1-module/cenlib-map/shelf-map-svg/shelves_index.csv` | Shelf ID reference |
| `src/assets/maps/` | Production SVG location |

---

## Summary Checklist

- [ ] Phase 1: Create shelf ID to visual label mapping
- [ ] Phase 2: Set up Google Sheet with mapping data
- [ ] Phase 3: Verify library/location names match Primo DOM
- [ ] Phase 4: Move SVG to assets and update config
- [ ] Phase 5: Test end-to-end flow

---

*Document created: 2026-01-25*
*Last updated: 2026-01-25*
