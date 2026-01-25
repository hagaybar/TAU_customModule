# Multi-Dimensional Mapping (MDM) Feature Specification

## Overview

Expand the CenLib Map feature from a single-library prototype to a multi-library, multi-location solution that correctly handles overlapping Dewey ranges across different libraries and locations.

**Problem:** Currently, call number 300 always maps to the same shelf. With multiple libraries, call number 300 in the Main Library should map to a different location than 300 in the Law Library.

**Solution:** Transform the mapping from 1D (range) to 3D (Library → Location → Range).

---

## Key Design Decisions

| Aspect | Decision |
|--------|----------|
| Library Scope | Configurable via config file. Start with Sourasky (MAIN) only |
| Fallback Behavior | Hide button silently if no mapping exists (no fallback) |
| Dialog Display | Library + Location + Call Number + Floor diagram with shelf(es) highlighted |
| Code Mapping | Use Primo codes directly (no name-to-code transformation) |
| Data Source | Google Sheets CSV as single source of truth |
| SVG Maps | Separate SVG file per library, stored in `src/assets/maps/` |
| Overlapping Ranges | Highlight ALL matching shelves simultaneously |
| Backward Compatibility | None - new CSV format only, create new Google Sheet |
| Pre-Implementation | DOM investigation required to confirm available selectors |

---

## 1. Data Architecture

### 1.1 New Google Sheet Schema

Create a **NEW** Google Sheet with the following columns:

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `libraryCode` | string | Yes | Library identifier from Primo | `MAIN`, `LAW`, `MED` |
| `locationCode` | string | Yes | Location/collection code from Primo | `GEN`, `REF`, `RESERVE` |
| `rangeStart` | string | Yes | Start of call number range (as-is) | `100`, `892.4` |
| `rangeEnd` | string | Yes | End of call number range (as-is) | `199`, `892.9` |
| `floor` | string | Yes | Floor number | `1`, `2`, `B1` |
| `svgCode` | string | Yes | SVG element ID to highlight | `SHELF-01`, `M-G-1` |
| `shelfLabel` | string | No | Physical shelf label | `A-3`, `Row 12` |
| `description` | string | No | English description | `General Collection - Floor 1` |
| `descriptionHe` | string | No | Hebrew description | `אוסף כללי - קומה 1` |
| `notes` | string | No | Librarian notes/special instructions | `Near elevator` |

### 1.2 Sample Data

```csv
libraryCode,locationCode,rangeStart,rangeEnd,floor,svgCode,shelfLabel,description,descriptionHe,notes
MAIN,GEN,1,99,1,SHELF-01,A-1,General Works,כללי,
MAIN,GEN,100,199,1,SHELF-02,A-2,Philosophy,פילוסופיה,
MAIN,GEN,200,299,1,SHELF-03,A-3,Religion,דת,Near stairs
MAIN,REF,1,999,2,REF-01,Reference,Reference Collection,אוסף עיון,
```

---

## 2. Configuration Architecture

### 2.1 Library Configuration

**File:** `src/app/custom1-module/cenlib-map/config/library.config.ts` (NEW)

Full metadata configuration for each supported library:

```typescript
export interface LibraryConfig {
  /** Primo library code (must match DOM data) */
  code: string;
  /** Display name in English */
  name: string;
  /** Display name in Hebrew */
  nameHe: string;
  /** Path to library's floor plan SVG */
  svgPath: string;
  /** Supported location codes for this library */
  locations: LocationConfig[];
}

export interface LocationConfig {
  /** Primo location code (must match DOM data) */
  code: string;
  /** Display name in English */
  name: string;
  /** Display name in Hebrew */
  nameHe: string;
}

export const LIBRARY_CONFIG: LibraryConfig[] = [
  {
    code: 'MAIN',
    name: 'Sourasky Central Library',
    nameHe: 'הספרייה המרכזית ע"ש סוראסקי',
    svgPath: 'assets/maps/sourasky-floor-plan.svg',
    locations: [
      { code: 'GEN', name: 'General Collection', nameHe: 'אוסף כללי' },
      { code: 'REF', name: 'Reference', nameHe: 'עיון' },
      { code: 'RESERVE', name: 'Reserve', nameHe: 'שמורים' },
    ]
  },
  // Additional libraries added here as needed
];
```

### 2.2 Configuration-Driven Visibility

The button only appears for items where:
1. `libraryCode` exists in `LIBRARY_CONFIG`
2. `locationCode` exists in that library's `locations` array
3. A matching range exists in the Google Sheets data

---

## 3. Interface Changes

### 3.1 Updated ShelfMapping Interface

**File:** `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts`

```typescript
export interface ShelfMapping {
  libraryCode: string;
  locationCode: string;
  rangeStart: string;       // Changed: string to preserve format (e.g., "892.4")
  rangeEnd: string;         // Changed: string to preserve format
  floor: string;
  svgCode: string;
  shelfLabel?: string;      // NEW: Physical shelf label
  description: string;
  descriptionHe?: string;
  notes?: string;           // NEW: Librarian notes
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
  /** Primo library code */
  libraryCode: string;
  /** Primo location code */
  locationCode: string;
  /** Library display name (from config) */
  libraryName?: string;
  /** Location display name (from config) */
  locationName?: string;
}
```

### 3.3 Updated Dialog Data Interface

**File:** `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts`

```typescript
export interface CenlibMapDialogData {
  callNumber: string;
  libraryCode: string;
  locationCode: string;
  libraryName?: string;
  libraryNameHe?: string;
  locationName?: string;
  locationNameHe?: string;
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

1. **Extract Library Code** from DOM (exact selectors TBD after investigation)
2. **Extract Location Code** from DOM (exact selectors TBD after investigation)
3. **Remove Cutter** from call number before storing
4. **Silent Check** - hide button if no mapping exists for library+location+range
5. **Pass Full Context** to dialog

#### Updated Properties:

```typescript
private callNumber: string = '';      // After cutter removal
private rawCallNumber: string = '';   // Original from DOM
private libraryCode: string = '';
private locationCode: string = '';
private libraryConfig: LibraryConfig | null = null;
private locationConfig: LocationConfig | null = null;
```

#### Updated Visibility Logic:

```typescript
private async checkShouldShow(): Promise<void> {
  // Check if library is configured
  this.libraryConfig = LIBRARY_CONFIG.find(lib => lib.code === this.libraryCode);
  if (!this.libraryConfig) {
    this.shouldShow = false;
    return;
  }

  // Check if location is configured for this library
  this.locationConfig = this.libraryConfig.locations.find(loc => loc.code === this.locationCode);
  if (!this.locationConfig) {
    this.shouldShow = false;
    return;
  }

  // Check if mapping exists
  const hasMapping = await this.shelfMappingService.hasMappingAsync(
    this.libraryCode,
    this.locationCode,
    this.callNumber
  ).toPromise();

  this.shouldShow = hasMapping;
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
// libraryCode -> locationCode -> ShelfMapping[]
private mappingIndex: Map<string, Map<string, ShelfMapping[]>> | null = null;
```

#### Updated/New Methods:

1. **buildMappingIndex()** - Build nested map after CSV load
2. **findAllMappings()** - Return ALL matching mappings (not just first)
3. **hasMapping()** - Check if any mapping exists for context
4. **removeCutter()** - Strip cutter string from call number
5. **normalize()** - Normalize codes for comparison

```typescript
/**
 * Find ALL mappings for a given context (supports overlapping ranges)
 */
findAllMappings(context: LocationContext): ShelfMapping[] {
  const libCode = this.normalize(context.libraryCode);
  const locCode = this.normalize(context.locationCode);

  const libMap = this.mappingIndex?.get(libCode);
  if (!libMap) return [];

  const mappings = libMap.get(locCode);
  if (!mappings) return [];

  // Return ALL mappings where call number is within range
  return mappings.filter(m =>
    this.matchesRange(context.callNumber, m.rangeStart, m.rangeEnd)
  );
}

/**
 * Check if any mapping exists
 */
hasMappingAsync(libraryCode: string, locationCode: string, callNumber: string): Observable<boolean> {
  return this.loadMappings().pipe(
    map(() => this.findAllMappings({
      callNumber,
      libraryCode,
      locationCode,
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
```

#### Updated CSV Parsing:

```typescript
interface CsvRow {
  libraryCode: string;
  locationCode: string;
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
    .filter(row => row.libraryCode && row.locationCode && row.rangeStart && row.rangeEnd && row.svgCode)
    .map(row => ({
      libraryCode: row.libraryCode.trim(),
      locationCode: row.locationCode.trim(),
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

## 7. DOM Investigation Task

### 7.1 Required Information

Before implementation, investigate the Primo NDE DOM to document:

| Data Point | Question | Action |
|------------|----------|--------|
| Library Code | Is there a `data-qa` attribute for library code? | Document selector |
| Library Name | What selector contains the library display name? | Document selector |
| Location Code | Is there a `data-qa` attribute for location code? | Document selector |
| Location Name | What selector contains the location display name? | Document selector |
| Call Number | Confirm current selector still works | Verify existing code |

### 7.2 Investigation Steps

1. Open Primo NDE in browser
2. Navigate to a search result with holdings
3. Open browser DevTools
4. Inspect `nde-location-item` elements
5. Document all available `data-qa` attributes
6. Document the DOM structure for library/location extraction
7. Test with multiple libraries if available

### 7.3 Output

Create a document: `docs/reference/primo-dom-selectors.md` with findings.

---

## 8. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `config/library.config.ts` | Library and location configuration |
| `models/location-context.model.ts` | LocationContext interface |
| `assets/maps/sourasky-floor-plan.svg` | Sourasky library floor plan |
| `docs/reference/primo-dom-selectors.md` | DOM investigation results |

### Modified Files

| File | Changes |
|------|---------|
| `config/shelf-mapping.config.ts` | Update ShelfMapping interface |
| `services/shelf-mapping.service.ts` | Add nested map, findAllMappings, cutter removal |
| `cenlib-map-button.component.ts` | Extract library/location, config-based visibility |
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

### Phase 0: Investigation
1. DOM Investigation - Document available selectors in Primo
2. Create `docs/reference/primo-dom-selectors.md`

### Phase 1: Data Layer
1. Create new Google Sheet with new schema
2. Update `shelf-mapping.config.ts` interface
3. Update `shelf-mapping.service.ts` for new CSV format
4. Add nested map indexing
5. Implement `findAllMappings()` for multiple results
6. Add cutter removal logic

### Phase 2: Configuration
1. Create `library.config.ts` with Sourasky only
2. Create `location-context.model.ts`
3. Remove/replace `location-filter.config.ts`

### Phase 3: Button Component
1. Update DOM extraction based on investigation
2. Implement config-based visibility check
3. Add cutter removal before storing call number
4. Pass full context to dialog

### Phase 4: Dialog & SVG
1. Update dialog to display full context
2. Add library name and location to header
3. Update SVG component for dynamic loading
4. Implement multiple shelf highlighting
5. Add Sourasky floor plan SVG to assets

### Phase 5: Testing
1. Test with Sourasky library data
2. Verify multiple shelf highlighting
3. Verify button visibility logic
4. Test Hebrew/English display

---

## 10. Testing Checklist

### Unit Tests

- [ ] `ShelfMappingService.parseCsv()` - new format parsing
- [ ] `ShelfMappingService.buildMappingIndex()` - correct structure
- [ ] `ShelfMappingService.findAllMappings()` - returns all matches
- [ ] `ShelfMappingService.removeCutter()` - various inputs
- [ ] `ShelfMappingService.matchesRange()` - edge cases
- [ ] Config lookup - library and location by code

### Integration Tests

- [ ] MAIN:GEN:301 → returns correct shelf(s)
- [ ] Overlapping ranges → returns multiple shelves
- [ ] Unmapped library → button hidden
- [ ] Unmapped location → button hidden
- [ ] Missing call number → button hidden

### Manual Testing

- [ ] Open item from Sourasky General Collection
- [ ] Verify button appears
- [ ] Click button → dialog shows library, location, call number
- [ ] Floor map displays with highlighted shelf(s)
- [ ] Test Hebrew language mode
- [ ] Test with multiple matching ranges
- [ ] Verify button hidden for unmapped items

---

## 11. Future Enhancements

| Feature | Priority | Notes |
|---------|----------|-------|
| Additional libraries | Medium | Add Law Library, Medical Library, etc. |
| Letter prefix support | Low | Handle call numbers like "E123" |
| LC call numbers | Low | Support Library of Congress classification |
| Deep linking | Low | URL to specific shelf location |
| Analytics | Low | Track button usage per library |
