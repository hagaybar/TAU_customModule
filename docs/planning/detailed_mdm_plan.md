# Multi-Dimensional Mapping (MDM) Feature Specification

## Overview

Expand the CenLib Map feature from a single-library prototype to a multi-library, multi-location solution that correctly handles overlapping Dewey ranges across different libraries and locations.

**Problem:** Currently, call number 300 always maps to the same shelf. With multiple libraries, call number 300 in the Main Library should map to a different location than 300 in the Law Library.

**Solution:** Transform the mapping from 1D (range) to 3D (Library → Location → Range).

---

## Key Design Decisions

| Aspect | Decision |
|--------|----------|
| Library Scope | Configurable via config file. Start with Sourasky only |
| Fallback Behavior | Hide button silently if no mapping exists (no fallback) |
| Dialog Display | Library + Location + Call Number + Floor diagram with shelf(es) highlighted |
| Name Mapping | Use display names from Primo DOM (Alma codes not available in DOM) |
| Data Source | Google Sheets CSV as single source of truth |
| SVG Maps | Separate SVG file per library, stored in `src/assets/maps/` |
| Overlapping Ranges | Highlight ALL matching shelves simultaneously |
| Backward Compatibility | None - new CSV format only, create new Google Sheet |
| DOM Data Available | Library name, location name, call number (via `.getit-library-title`, `[data-qa]` attrs) |

---

## 1. Data Architecture

### 1.1 New Google Sheet Schema

Create a **NEW** Google Sheet with the following columns:

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `libraryName` | string | Yes | Library display name (Hebrew, as shown in Primo) | `הספרייה המרכזית סוראסקי`, `הספרייה למדעים מדויקים ולהנדסה` |
| `locationName` | string | Yes | Location/sublocation display name (Hebrew, as shown in Primo) | `אוסף כללי`, `ספרי לימוד - קומת כניסה` |
| `rangeStart` | string | Yes | Start of call number range (as-is) | `100`, `892.4` |
| `rangeEnd` | string | Yes | End of call number range (as-is) | `199`, `892.9` |
| `floor` | string | Yes | Floor number | `1`, `2`, `B1` |
| `svgCode` | string | Yes | SVG element ID to highlight | `SHELF-01`, `M-G-1` |
| `shelfLabel` | string | No | Physical shelf label | `A-3`, `Row 12` |
| `description` | string | No | English description | `General Collection - Floor 1` |
| `descriptionHe` | string | No | Hebrew description | `אוסף כללי - קומה 1` |
| `notes` | string | No | Librarian notes/special instructions | `Near elevator` |

**Important:** The `libraryName` and `locationName` values must **exactly match** the text displayed in the Primo NDE DOM (including Hebrew characters and spaces).

### 1.2 Sample Data

```csv
libraryName,locationName,rangeStart,rangeEnd,floor,svgCode,shelfLabel,description,descriptionHe,notes
הספרייה המרכזית סוראסקי,אוסף כללי,1,99,1,SHELF-01,A-1,General Works,כללי,
הספרייה המרכזית סוראסקי,אוסף כללי,100,199,1,SHELF-02,A-2,Philosophy,פילוסופיה,
הספרייה המרכזית סוראסקי,אוסף כללי,200,299,1,SHELF-03,A-3,Religion,דת,Near stairs
הספרייה למדעים מדויקים ולהנדסה,ספרי לימוד - קומת כניסה,500,599,1,SHELF-05,B-1,Computer Science,מדעי המחשב,
```

---

## 2. Configuration Architecture

### 2.1 Library Configuration

**File:** `src/app/custom1-module/cenlib-map/config/library.config.ts` (NEW)

Full metadata configuration for each supported library. **Note:** The `nameHe` field is the key used to match against the Primo DOM.

```typescript
export interface LibraryConfig {
  /** Display name in Hebrew (MUST match Primo DOM exactly - this is the lookup key) */
  nameHe: string;
  /** Display name in English (for UI) */
  name: string;
  /** Path to library's floor plan SVG */
  svgPath: string;
  /** Supported locations for this library */
  locations: LocationConfig[];
}

export interface LocationConfig {
  /** Display name in Hebrew (MUST match Primo DOM exactly - this is the lookup key) */
  nameHe: string;
  /** Display name in English (for UI) */
  name: string;
}

export const LIBRARY_CONFIG: LibraryConfig[] = [
  {
    nameHe: 'הספרייה המרכזית סוראסקי',
    name: 'Sourasky Central Library',
    svgPath: 'assets/maps/sourasky-floor-plan.svg',
    locations: [
      { nameHe: 'אוסף כללי', name: 'General Collection' },
      { nameHe: 'עיון', name: 'Reference' },
      { nameHe: 'שמורים', name: 'Reserve' },
    ]
  },
  {
    nameHe: 'הספרייה למדעים מדויקים ולהנדסה',
    name: 'Exact Sciences and Engineering Library',
    svgPath: 'assets/maps/exact-sciences-floor-plan.svg',
    locations: [
      { nameHe: 'ספרי לימוד - קומת כניסה', name: 'Textbooks - Entrance Floor' },
    ]
  },
  // Additional libraries added here as needed
];
```

### 2.2 Configuration-Driven Visibility

The button only appears for items where:
1. `libraryName` (from DOM) exists in `LIBRARY_CONFIG` (matched by `nameHe`)
2. `locationName` (from DOM) exists in that library's `locations` array (matched by `nameHe`)
3. A matching range exists in the Google Sheets data for that library+location combination

---

## 3. Interface Changes

### 3.1 Updated ShelfMapping Interface

**File:** `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts`

```typescript
export interface ShelfMapping {
  libraryName: string;      // Hebrew name from Primo DOM (e.g., "הספרייה המרכזית סוראסקי")
  locationName: string;     // Hebrew name from Primo DOM (e.g., "אוסף כללי")
  rangeStart: string;       // String to preserve format (e.g., "892.4")
  rangeEnd: string;         // String to preserve format
  floor: string;
  svgCode: string;
  shelfLabel?: string;      // Physical shelf label
  description: string;
  descriptionHe?: string;
  notes?: string;           // Librarian notes
}
```

### 3.2 Location Context Interface

**File:** `src/app/custom1-module/cenlib-map/models/location-context.model.ts` (NEW)

```typescript
export interface LocationContext {
  /** Call number WITHOUT cutter string */
  callNumber: string;
  /** Raw call number from DOM (before cutter removal) */
  rawCallNumber: string;
  /** Library display name in Hebrew (from DOM via .getit-library-title) */
  libraryName: string;
  /** Location display name in Hebrew (from DOM via [data-qa="location-sub-location"]) */
  locationName: string;
  /** Library display name in English (from config lookup) */
  libraryNameEn?: string;
  /** Location display name in English (from config lookup) */
  locationNameEn?: string;
}
```

### 3.3 Updated Dialog Data Interface

**File:** `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts`

```typescript
export interface CenlibMapDialogData {
  callNumber: string;
  /** Library name in Hebrew (primary key, from DOM) */
  libraryName: string;
  /** Location name in Hebrew (primary key, from DOM) */
  locationName: string;
  /** Library name in English (from config lookup, for display) */
  libraryNameEn?: string;
  /** Location name in English (from config lookup, for display) */
  locationNameEn?: string;
}
```

---

## 4. Call Number Processing

### 4.1 Cutter String Removal

Remove cutter string from Primo call number before matching:
- **Pattern:** Everything after the last space that starts with letters
- **Regex:** `/\s+[A-Za-zא-ת].*$/`

**Examples:**
| Input | Output |
|-------|--------|
| `892.413 מאו` | `892.413` |
| `301.5 ABC` | `301.5` |
| `QA76.73` | `QA76.73` (no cutter) |
| `100` | `100` (no cutter) |

### 4.2 Range Matching Logic

```typescript
private matchesRange(callNumber: string, rangeStart: string, rangeEnd: string): boolean {
  const numValue = this.extractNumericValue(callNumber);
  const startValue = this.extractNumericValue(rangeStart);
  const endValue = this.extractNumericValue(rangeEnd);

  if (numValue === null || startValue === null || endValue === null) {
    return false;
  }

  return numValue >= startValue && numValue <= endValue;
}
```

### 4.3 Future Consideration: Letter Prefixes

Some call numbers may begin with a letter (e.g., "E123"). This will be addressed in a later stage. For now, the first numeric sequence is extracted.

---

## 5. Component Changes

### 5.1 CenlibMapButtonComponent

**File:** `src/app/custom1-module/cenlib-map/cenlib-map-button.component.ts`

#### Changes Required:

1. **Extract Library Name** from DOM via `.getit-library-title` selector
2. **Extract Location Name** from DOM via `[data-qa="location-sub-location"]` selector
3. **Remove Cutter** from call number before storing
4. **Silent Check** - hide button if no mapping exists for library+location+range
5. **Pass Full Context** to dialog

#### DOM Selectors (from investigation):

| Data | Selector | Example Value |
|------|----------|---------------|
| Library Name | `.getit-library-title` | `הספרייה למדעים מדויקים ולהנדסה` |
| Location Name | `[data-qa="location-sub-location"]` | `ספרי לימוד - קומת כניסה` |
| Call Number | `[data-qa="location-call-number"]` | `519.836 ZEL` |

#### Updated Properties:

```typescript
private callNumber: string = '';      // After cutter removal
private rawCallNumber: string = '';   // Original from DOM
private libraryName: string = '';     // Hebrew name from DOM
private locationName: string = '';    // Hebrew name from DOM
private libraryConfig: LibraryConfig | null = null;
private locationConfig: LocationConfig | null = null;
```

#### Updated Visibility Logic:

```typescript
private async checkShouldShow(): Promise<void> {
  // Check if library is configured (match by Hebrew name)
  this.libraryConfig = LIBRARY_CONFIG.find(lib =>
    this.normalizeForComparison(lib.nameHe) === this.normalizeForComparison(this.libraryName)
  );
  if (!this.libraryConfig) {
    this.shouldShow = false;
    return;
  }

  // Check if location is configured for this library (match by Hebrew name)
  this.locationConfig = this.libraryConfig.locations.find(loc =>
    this.normalizeForComparison(loc.nameHe) === this.normalizeForComparison(this.locationName)
  );
  if (!this.locationConfig) {
    this.shouldShow = false;
    return;
  }

  // Check if mapping exists
  const hasMapping = await this.shelfMappingService.hasMappingAsync(
    this.libraryName,
    this.locationName,
    this.callNumber
  ).toPromise();

  this.shouldShow = hasMapping;
}

/** Normalize string for comparison (trim, lowercase, collapse whitespace) */
private normalizeForComparison(str: string): string {
  return str?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}
```

### 5.2 CenlibMapDialogComponent

**File:** `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts`

#### Changes Required:

1. **Display Full Context** - Library name, location name, call number
2. **Load Library-Specific SVG** based on library code
3. **Highlight ALL Matching Shelves** in the SVG
4. **Support Multiple Matches** - show all overlapping shelf areas

#### Updated Template (conceptual):

```html
<h2 mat-dialog-title>{{ dialogTitle }}</h2>
<mat-dialog-content>
  <!-- Context Info -->
  <div class="location-info">
    <div class="info-row">
      <span class="label">{{ libraryLabel }}</span>
      <span class="value">{{ getLibraryName() }}</span>
    </div>
    <div class="info-row">
      <span class="label">{{ locationLabel }}</span>
      <span class="value">{{ getLocationName() }}</span>
    </div>
    <div class="info-row">
      <span class="label">{{ callNumberLabel }}</span>
      <span class="value">{{ data.callNumber }}</span>
    </div>
  </div>

  <!-- Floor Map with Multiple Highlights -->
  <tau-shelf-map-svg
    [svgPath]="librarySvgPath"
    [highlightedShelfCodes]="matchingShelfCodes"
    [floor]="displayFloor"
    [language]="currentLanguage">
  </tau-shelf-map-svg>

  <!-- Matching Shelves Info -->
  <div class="shelf-info" *ngIf="mappings.length > 0">
    <div *ngFor="let mapping of mappings" class="shelf-item">
      <span class="floor">{{ floorLabel }} {{ mapping.floor }}</span>
      <span class="shelf">{{ mapping.shelfLabel || mapping.svgCode }}</span>
      <span class="description">{{ getDescription(mapping) }}</span>
    </div>
  </div>
</mat-dialog-content>
```

### 5.3 ShelfMapSvgComponent Updates

**File:** `src/app/custom1-module/cenlib-map/shelf-map-svg/shelf-map-svg.component.ts`

#### Changes Required:

1. **Accept `svgPath` Input** - load SVG dynamically based on library
2. **Accept `highlightedShelfCodes` Array** - support multiple highlights
3. **Load SVG from Assets** - fetch from `src/assets/maps/`

```typescript
@Input() svgPath: string = '';
@Input() highlightedShelfCodes: string[] = [];  // Changed from single string
@Input() initialFloor: string = '1';
@Input() language: 'en' | 'he' = 'en';
```

---

## 6. Service Layer Changes

### 6.1 ShelfMappingService

**File:** `src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts`

#### New Data Structure (Nested Map):

```typescript
// libraryName (normalized) -> locationName (normalized) -> ShelfMapping[]
private mappingIndex: Map<string, Map<string, ShelfMapping[]>> | null = null;
```

#### Updated/New Methods:

1. **buildMappingIndex()** - Build nested map after CSV load (keyed by normalized names)
2. **findAllMappings()** - Return ALL matching mappings (not just first)
3. **hasMapping()** - Check if any mapping exists for context
4. **removeCutter()** - Strip cutter string from call number
5. **normalize()** - Normalize names for comparison (trim, lowercase, collapse whitespace)

```typescript
/**
 * Find ALL mappings for a given context (supports overlapping ranges)
 */
findAllMappings(context: LocationContext): ShelfMapping[] {
  const libName = this.normalize(context.libraryName);
  const locName = this.normalize(context.locationName);

  const libMap = this.mappingIndex?.get(libName);
  if (!libMap) return [];

  const mappings = libMap.get(locName);
  if (!mappings) return [];

  // Return ALL mappings where call number is within range
  return mappings.filter(m =>
    this.matchesRange(context.callNumber, m.rangeStart, m.rangeEnd)
  );
}

/**
 * Check if any mapping exists
 */
hasMappingAsync(libraryName: string, locationName: string, callNumber: string): Observable<boolean> {
  return this.loadMappings().pipe(
    map(() => this.findAllMappings({
      callNumber,
      libraryName,
      locationName,
      rawCallNumber: callNumber
    }).length > 0)
  );
}

/**
 * Remove cutter string from call number
 * Pattern: Everything after last space that starts with letters
 */
removeCutter(callNumber: string): string {
  if (!callNumber) return '';
  return callNumber.replace(/\s+[A-Za-zא-ת].*$/, '').trim();
}

/**
 * Normalize string for map key comparison
 * Handles Hebrew characters, trims whitespace, lowercases
 */
private normalize(str: string): string {
  return str?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}
```

#### Updated CSV Parsing:

```typescript
interface CsvRow {
  libraryName: string;    // Hebrew name
  locationName: string;   // Hebrew name
  rangeStart: string;
  rangeEnd: string;
  floor: string;
  svgCode: string;
  shelfLabel: string;
  description: string;
  descriptionHe: string;
  notes: string;
}

private parseCsv(csv: string): ShelfMapping[] {
  const result = Papa.parse<CsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  return result.data
    .filter(row => row.libraryName && row.locationName && row.rangeStart && row.rangeEnd && row.svgCode)
    .map(row => ({
      libraryName: row.libraryName.trim(),
      locationName: row.locationName.trim(),
      rangeStart: row.rangeStart.trim(),
      rangeEnd: row.rangeEnd.trim(),
      floor: row.floor?.trim() || '',
      svgCode: row.svgCode.trim(),
      shelfLabel: row.shelfLabel?.trim() || undefined,
      description: row.description?.trim() || '',
      descriptionHe: row.descriptionHe?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
    }));
}
```

---

## 7. DOM Investigation Results (COMPLETED)

### 7.1 Investigation Summary

DOM investigation was completed on 2026-01-22. Key finding: **Alma codes are NOT available in the Primo NDE DOM** - only display names are exposed.

### 7.2 Available Selectors

| Data Point | Selector | Example Value | Notes |
|------------|----------|---------------|-------|
| Library Name | `.getit-library-title` | `הספרייה למדעים מדויקים ולהנדסה` | Hebrew display name |
| Location Name | `[data-qa="location-sub-location"]` | `ספרי לימוד - קומת כניסה` | Hebrew display name |
| Call Number | `[data-qa="location-call-number"]` | `519.836 ZEL` | Includes cutter |
| Availability | `[data-qa="location-availability"]` | `נמצא` | Status text |

### 7.3 What is NOT Available

| Data Point | Status |
|------------|--------|
| Library Code (e.g., `SCIEN`, `MAIN`) | ❌ Not in DOM |
| Location Code (e.g., `TEXTBOOK`, `GEN`) | ❌ Not in DOM |
| `data-qa` attributes with codes | ❌ Not present |

### 7.4 Conclusion

The system must use **display names** (Hebrew) as the primary keys for mapping, since Alma codes are not exposed in the Primo NDE DOM. This requires:
- Exact string matching (with normalization for whitespace/case)
- CSV and config files must use the exact Hebrew names as they appear in Primo
- Changes to names in Alma will require corresponding updates to the mapping data

---

## 8. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `config/library.config.ts` | Library and location configuration (keyed by Hebrew names) |
| `models/location-context.model.ts` | LocationContext interface |
| `assets/maps/sourasky-floor-plan.svg` | Sourasky library floor plan |
| `assets/maps/exact-sciences-floor-plan.svg` | Exact Sciences library floor plan |

### Modified Files

| File | Changes |
|------|---------|
| `config/shelf-mapping.config.ts` | Update ShelfMapping interface (use names instead of codes) |
| `services/shelf-mapping.service.ts` | Add nested map keyed by names, findAllMappings, cutter removal, normalize() |
| `cenlib-map-button.component.ts` | Extract library/location names from DOM, config-based visibility |
| `cenlib-map-dialog/cenlib-map-dialog.component.ts` | Display full context, multiple highlights |
| `cenlib-map-dialog/cenlib-map-dialog.component.html` | Updated template |
| `shelf-map-svg/shelf-map-svg.component.ts` | Dynamic SVG loading, multiple highlights |
| `config/google-sheets.config.ts` | New Google Sheets URL |

### Files to Remove/Replace

| File | Action |
|------|--------|
| `config/location-filter.config.ts` | Replace with `library.config.ts` |

---

## 9. Implementation Order

### Phase 0: Investigation ✅ COMPLETED
1. ~~DOM Investigation - Document available selectors in Primo~~
2. ~~Create DOM selectors documentation~~ (included in this document, Section 7)

**Key Finding:** Alma codes are not available in DOM. Use display names instead.

### Phase 1: Data Layer
1. Create new Google Sheet with new schema (using Hebrew names)
2. Update `shelf-mapping.config.ts` interface (libraryName, locationName)
3. Update `shelf-mapping.service.ts` for new CSV format
4. Add nested map indexing (keyed by normalized names)
5. Implement `findAllMappings()` for multiple results
6. Add cutter removal logic and `normalize()` function

### Phase 2: Configuration
1. Create `library.config.ts` with libraries (keyed by Hebrew nameHe)
2. Create `location-context.model.ts`
3. Remove/replace `location-filter.config.ts`

### Phase 3: Button Component
1. Extract library name via `.getit-library-title`
2. Extract location name via `[data-qa="location-sub-location"]`
3. Implement config-based visibility check (matching by normalized names)
4. Add cutter removal before storing call number
5. Pass full context to dialog

### Phase 4: Dialog & SVG
1. Update dialog to display full context
2. Add library name and location to header
3. Update SVG component for dynamic loading
4. Implement multiple shelf highlighting
5. Add floor plan SVGs to assets

### Phase 5: Testing
1. Test with library data (exact Hebrew name matching)
2. Verify multiple shelf highlighting
3. Verify button visibility logic
4. Test Hebrew/English display

---

## 10. Testing Checklist

### Unit Tests

- [ ] `ShelfMappingService.parseCsv()` - new format parsing (with Hebrew names)
- [ ] `ShelfMappingService.buildMappingIndex()` - correct structure (keyed by normalized names)
- [ ] `ShelfMappingService.findAllMappings()` - returns all matches
- [ ] `ShelfMappingService.removeCutter()` - various inputs
- [ ] `ShelfMappingService.matchesRange()` - edge cases
- [ ] `ShelfMappingService.normalize()` - Hebrew strings, whitespace, case
- [ ] Config lookup - library and location by Hebrew name

### Integration Tests

- [ ] `הספרייה המרכזית סוראסקי:אוסף כללי:301` → returns correct shelf(s)
- [ ] Overlapping ranges → returns multiple shelves
- [ ] Unmapped library name → button hidden
- [ ] Unmapped location name → button hidden
- [ ] Missing call number → button hidden
- [ ] Name with extra whitespace → still matches (via normalize)

### Manual Testing

- [ ] Open item from Sourasky General Collection
- [ ] Verify button appears
- [ ] Click button → dialog shows library, location, call number
- [ ] Floor map displays with highlighted shelf(s)
- [ ] Test Hebrew language mode
- [ ] Test with multiple matching ranges
- [ ] Verify button hidden for unmapped items
- [ ] Test with Exact Sciences Library item

---

## 11. Future Enhancements

| Feature | Priority | Notes |
|---------|----------|-------|
| Additional libraries | Medium | Add Law Library, Medical Library, etc. |
| Letter prefix support | Low | Handle call numbers like "E123" |
| LC call numbers | Low | Support Library of Congress classification |
| Deep linking | Low | URL to specific shelf location |
| Analytics | Low | Track button usage per library |
