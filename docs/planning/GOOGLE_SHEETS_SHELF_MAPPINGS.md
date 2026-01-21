# Plan: Move Shelf Mappings to Google Sheets

## Overview
Move the 30 shelf mappings from hard-coded `shelf-mapping.config.ts` to a publicly accessible Google Sheet, fetched as CSV at runtime.

---

## Part 1: Google Sheet Setup (Manual)

### Step 1: Create the Sheet
1. Go to Google Sheets and create a new spreadsheet
2. Name it: `CenLib Shelf Mappings`

### Step 2: Create Headers (Row 1)
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| rangeStart | rangeEnd | svgCode | description | descriptionHe | floor |

### Step 3: Populate Data (Rows 2-31)
Copy the 30 shelf mappings. Example first few rows:

| rangeStart | rangeEnd | svgCode | description | descriptionHe | floor |
|------------|----------|---------|-------------|---------------|-------|
| 1 | 33 | SHELF-01 | General Works A | כללי א | 1 |
| 34 | 66 | SHELF-02 | General Works B | כללי ב | 1 |
| 67 | 99 | SHELF-03 | General Works C | כללי ג | 1 |
| ... | ... | ... | ... | ... | ... |

### Step 4: Publish as CSV
1. Go to **File → Share → Publish to web**
2. Select the sheet tab (e.g., "Sheet1")
3. Change format from "Web page" to **"Comma-separated values (.csv)"**
4. Click **Publish**
5. Copy the generated URL (format: `https://docs.google.com/spreadsheets/d/e/{DOCUMENT_ID}/pub?output=csv`)

---

## Part 2: Code Changes

### Files to Modify
1. `src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts` - Main changes
2. `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts` - Keep as fallback

### New File to Create
- `src/app/custom1-module/cenlib-map/config/google-sheets.config.ts` - URL configuration

---

### 2.1 Create Google Sheets Config
**File:** `config/google-sheets.config.ts`

```typescript
export const GOOGLE_SHEETS_CONFIG = {
  shelfMappingsUrl: 'YOUR_PUBLISHED_CSV_URL_HERE',
  cacheDurationMs: 5 * 60 * 1000, // 5 minutes cache
};
```

---

### 2.2 Update ShelfMappingService
**File:** `services/shelf-mapping.service.ts`

Changes:
1. Add `HttpClient` injection
2. Add caching mechanism (avoid fetching on every button click)
3. Add `loadMappings()` method that fetches from Google Sheets
4. Use Papa Parse to parse CSV → JSON
5. Fallback to hard-coded `SHELF_MAPPINGS` if fetch fails
6. Make `findMapping()` work with async data

**Key implementation details:**
- Cache mappings in memory with timestamp
- Re-fetch only if cache expired (5 minutes default)
- `loadMappings()` returns `Observable<ShelfMapping[]>`
- Keep synchronous `findMappingSync()` for backwards compatibility using cached data

---

### 2.3 Install Papa Parse
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

---

### 2.4 Update Dialog Component
**File:** `cenlib-map-dialog/cenlib-map-dialog.component.ts`

The dialog needs to ensure mappings are loaded before use. Options:
- **Option A:** Load mappings when dialog opens (add loading state)
- **Option B:** Pre-load mappings when button is rendered

Recommendation: **Option A** - Load in dialog with brief loading indicator

---

## Part 3: Implementation Sequence

1. Install Papa Parse dependency
2. Create `google-sheets.config.ts` with placeholder URL
3. Update `ShelfMappingService`:
   - Add HttpClient import
   - Add cache properties (`cachedMappings`, `cacheTimestamp`)
   - Add `loadMappings()` async method
   - Keep `findMapping()` working with cached data
   - Add fallback to hard-coded data on error
4. Update `cenlib-map-dialog.component.ts` to call `loadMappings()` on open
5. Add loading state to dialog template
6. Test with real Google Sheet URL
7. Keep `shelf-mapping.config.ts` as fallback (don't delete)

---

## Part 4: Error Handling Strategy

```
┌─────────────────────────────────────────┐
│  Dialog Opens                           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Is cache valid? (< 5 min old)          │
└────────────────┬────────────────────────┘
          Yes    │    No
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐   ┌───────────────────────┐
│ Use cached    │   │ Fetch from Google     │
│ mappings      │   │ Sheets CSV            │
└───────────────┘   └───────────┬───────────┘
                          Success│Fail
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌───────────────┐     ┌─────────────────┐
            │ Parse CSV &   │     │ Use fallback    │
            │ cache result  │     │ SHELF_MAPPINGS  │
            └───────────────┘     └─────────────────┘
```

---

## Part 5: Verification

1. **Unit test:** Mock HTTP call, verify CSV parsing works
2. **Integration test:**
   - Create test Google Sheet
   - Verify data loads correctly
   - Verify caching works (only 1 request per 5 min)
3. **Error test:** Block network, verify fallback to hard-coded data
4. **Manual test in browser:**
   - Open Primo with cenlib-map
   - Find an item with call number (e.g., "892.413")
   - Click the shelf map button
   - Verify correct shelf is highlighted
   - Check Network tab: CSV should be fetched once
   - Click button again: should use cache (no new request)

---

## Summary of Changes

| File | Action |
|------|--------|
| `config/google-sheets.config.ts` | **Create** - URL configuration |
| `services/shelf-mapping.service.ts` | **Modify** - Add async loading, caching, fallback |
| `cenlib-map-dialog.component.ts` | **Modify** - Call loadMappings(), add loading state |
| `cenlib-map-dialog.component.html` | **Modify** - Add loading indicator |
| `config/shelf-mapping.config.ts` | **Keep** - Fallback data (no changes) |
| `package.json` | **Modify** - Add papaparse dependency |
