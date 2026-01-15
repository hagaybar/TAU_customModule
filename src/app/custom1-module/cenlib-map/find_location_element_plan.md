# CenLib Map Feature - Implementation Plan (Phases 0-2)

## Feature Overview
A custom button in the "get-it" section that displays a modal dialog showing the shelf location for physical items. The button will appear within the location row (integrated with call number/availability display). Call numbers will be mapped to SVG shelf codes using range-based numeric patterns.

## User Preferences
- **Button Placement**: Within location row (integrated with availability/call number)
- **Dialog Type**: Modal dialog (centered overlay with backdrop)
- **Mapping Format**: Range-based numeric patterns

---

## Phase 0: Simple POC - Button with Modal Dialog

### Goal
Create a button in the get-it location row that opens a modal dialog when clicked.

### Files to Create

#### 1. Button Component
```
src/app/custom1-module/cenlib-map/
├── cenlib-map-button.component.ts
├── cenlib-map-button.component.html
└── cenlib-map-button.component.scss
```

#### 2. Dialog Component
```
src/app/custom1-module/cenlib-map/cenlib-map-dialog/
├── cenlib-map-dialog.component.ts
├── cenlib-map-dialog.component.html
└── cenlib-map-dialog.component.scss
```

### Implementation Details

#### Button Component (`cenlib-map-button.component.ts`)
```typescript
@Component({
  selector: 'tau-cenlib-map-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './cenlib-map-button.component.html',
  styleUrls: ['./cenlib-map-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenlibMapButtonComponent {
  constructor(private dialog: MatDialog) {}

  openMapDialog(): void {
    this.dialog.open(CenlibMapDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });
  }
}
```

#### Button Template (`cenlib-map-button.component.html`)
```html
<button mat-stroked-button
        class="cenlib-map-button"
        (click)="openMapDialog()"
        aria-label="Show shelf map">
  <mat-icon>map</mat-icon>
  <span class="button-text">{{ buttonLabel }}</span>
</button>
```

#### Dialog Component (`cenlib-map-dialog.component.ts`)
```typescript
@Component({
  selector: 'tau-cenlib-map-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './cenlib-map-dialog.component.html',
  styleUrls: ['./cenlib-map-dialog.component.scss'],
})
export class CenlibMapDialogComponent {
  constructor(public dialogRef: MatDialogRef<CenlibMapDialogComponent>) {}
}
```

#### Dialog Template (`cenlib-map-dialog.component.html`)
```html
<h2 mat-dialog-title>Shelf Location Map</h2>
<mat-dialog-content>
  <p>Map will appear here</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="dialogRef.close()">Close</button>
</mat-dialog-actions>
```

### Files to Modify

#### `src/app/custom1-module/customComponentMappings.ts`
```typescript
import { CenlibMapButtonComponent } from './cenlib-map/cenlib-map-button.component';

export const selectorComponentMap = new Map<string, any>([
  ['nde-filters-group-before', FilterAssistPanelComponent],
  ['nde-search-no-results', NoResultsExternalLinksComponent],
  ['nde-location-item-bottom', CenlibMapButtonComponent],  // NEW
]);
```

### Button Styling (inline appearance)
```scss
.cenlib-map-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  padding: 4px 8px;
  margin-top: 8px;

  mat-icon {
    font-size: 18px;
    width: 18px;
    height: 18px;
  }
}
```

### Verification Steps
1. Run `npm run start:proxy`
2. Navigate to Primo and search for a physical item with holdings
3. Expand the get-it section to see location items
4. Verify button appears within/below each location row
5. Click button → modal dialog opens with placeholder content
6. Click Close or click backdrop → dialog closes

---

## Phase 1: Display Call Number in Dialog

### Goal
Extract the call number from the location item and display it in the modal dialog.

### Implementation Approach

The button component will extract the call number using DOM traversal from its host element position. The NDE inserts our component at `nde-location-item-bottom`, so we can traverse up to find `nde-location-item` and then query for `[data-qa="location-call-number"]`.

### Modified Files

#### `cenlib-map-button.component.ts` (additions)
```typescript
export class CenlibMapButtonComponent implements AfterViewInit {
  private elementRef = inject(ElementRef);
  private callNumber: string = '';

  ngAfterViewInit(): void {
    this.extractCallNumber();
  }

  private extractCallNumber(): void {
    // Traverse up to find the nde-location-item parent
    const locationItem = this.elementRef.nativeElement.closest('nde-location-item');
    if (locationItem) {
      // Try the data-qa selector first (expanded view)
      const callNumberEl = locationItem.querySelector('[data-qa="location-call-number"]');
      if (callNumberEl) {
        this.callNumber = callNumberEl.textContent?.trim() || '';
        return;
      }
      // Fallback: brief property view (3rd column)
      const briefCallNumber = locationItem.querySelector(
        '.getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]'
      );
      if (briefCallNumber) {
        this.callNumber = briefCallNumber.textContent?.trim() || '';
      }
    }
  }

  openMapDialog(): void {
    this.dialog.open(CenlibMapDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: { callNumber: this.callNumber }
    });
  }
}
```

#### `cenlib-map-dialog.component.ts` (additions)
```typescript
export class CenlibMapDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CenlibMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { callNumber: string }
  ) {}
}
```

#### `cenlib-map-dialog.component.html` (updated)
```html
<h2 mat-dialog-title>Shelf Location Map</h2>
<mat-dialog-content>
  <div class="call-number-display">
    <span class="label">Call Number:</span>
    <span class="value" dir="ltr">{{ data.callNumber || 'Not available' }}</span>
  </div>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="dialogRef.close()">Close</button>
</mat-dialog-actions>
```

### Verification Steps
1. Search for a physical item with a known call number
2. Click the map button
3. Verify the call number appears correctly in the dialog
4. Test with Hebrew call numbers (e.g., "892.413 מאו") - should display LTR
5. Test with item that has no call number - should show "Not available"

---

## Phase 2: Range-Based Call Number Mapping

### Goal
Map call numbers to SVG shelf codes using numeric range patterns and display both values in the dialog.

### New Files to Create

#### `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts`
```typescript
export interface ShelfMapping {
  rangeStart: number;
  rangeEnd: number;
  svgCode: string;
  description: string;
  floor?: string;
}

// Test mappings - range-based on Dewey Decimal classification
export const SHELF_MAPPINGS: ShelfMapping[] = [
  { rangeStart: 0, rangeEnd: 99, svgCode: 'SHELF-GEN-01', description: 'General Works', floor: '1' },
  { rangeStart: 100, rangeEnd: 199, svgCode: 'SHELF-PHI-02', description: 'Philosophy', floor: '1' },
  { rangeStart: 200, rangeEnd: 299, svgCode: 'SHELF-REL-03', description: 'Religion', floor: '1' },
  { rangeStart: 300, rangeEnd: 399, svgCode: 'SHELF-SOC-04', description: 'Social Sciences', floor: '2' },
  { rangeStart: 400, rangeEnd: 499, svgCode: 'SHELF-LNG-05', description: 'Language', floor: '2' },
  { rangeStart: 500, rangeEnd: 599, svgCode: 'SHELF-SCI-06', description: 'Science', floor: '2' },
  { rangeStart: 600, rangeEnd: 699, svgCode: 'SHELF-TEC-07', description: 'Technology', floor: '3' },
  { rangeStart: 700, rangeEnd: 799, svgCode: 'SHELF-ART-08', description: 'Arts', floor: '3' },
  { rangeStart: 800, rangeEnd: 899, svgCode: 'SHELF-LIT-09', description: 'Literature', floor: '3' },
  { rangeStart: 900, rangeEnd: 999, svgCode: 'SHELF-HIS-10', description: 'History', floor: '4' },
];
```

#### `src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { SHELF_MAPPINGS, ShelfMapping } from '../config/shelf-mapping.config';

@Injectable({ providedIn: 'root' })
export class ShelfMappingService {

  /**
   * Extract the numeric portion from a call number
   * Examples: "892.413 מאו" → 892, "QA76.73" → 76
   */
  extractNumericValue(callNumber: string): number | null {
    const match = callNumber.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Find shelf mapping for a given call number
   */
  findMapping(callNumber: string): ShelfMapping | null {
    const numValue = this.extractNumericValue(callNumber);
    if (numValue === null) return null;

    return SHELF_MAPPINGS.find(
      mapping => numValue >= mapping.rangeStart && numValue <= mapping.rangeEnd
    ) || null;
  }
}
```

### Modified Files

#### `cenlib-map-dialog.component.ts` (updated)
```typescript
export class CenlibMapDialogComponent implements OnInit {
  mapping: ShelfMapping | null = null;

  constructor(
    public dialogRef: MatDialogRef<CenlibMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { callNumber: string },
    private shelfMappingService: ShelfMappingService
  ) {}

  ngOnInit(): void {
    if (this.data.callNumber) {
      this.mapping = this.shelfMappingService.findMapping(this.data.callNumber);
    }
  }
}
```

#### `cenlib-map-dialog.component.html` (updated)
```html
<h2 mat-dialog-title>Shelf Location Map</h2>
<mat-dialog-content>
  <div class="location-info">
    <div class="info-row">
      <span class="label">Call Number:</span>
      <span class="value" dir="ltr">{{ data.callNumber || 'Not available' }}</span>
    </div>

    <ng-container *ngIf="mapping; else noMapping">
      <div class="info-row">
        <span class="label">SVG Code:</span>
        <span class="value">{{ mapping.svgCode }}</span>
      </div>
      <div class="info-row">
        <span class="label">Section:</span>
        <span class="value">{{ mapping.description }}</span>
      </div>
      <div class="info-row" *ngIf="mapping.floor">
        <span class="label">Floor:</span>
        <span class="value">{{ mapping.floor }}</span>
      </div>
    </ng-container>

    <ng-template #noMapping>
      <div class="no-mapping-message">
        <p>Shelf location not found for this call number.</p>
      </div>
    </ng-template>
  </div>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="dialogRef.close()">Close</button>
</mat-dialog-actions>
```

### Verification Steps
1. Search for items with different call numbers in various Dewey ranges
2. Verify correct SVG code mapping:
   - Call number starting with 8xx → `SHELF-LIT-09` (Literature)
   - Call number starting with 3xx → `SHELF-SOC-04` (Social Sciences)
3. Test call number that doesn't match any range → "Shelf location not found"
4. Test call number without numeric portion → graceful fallback

---

## Summary of All Files

### Phase 0 - Create
| File | Purpose |
|------|---------|
| `src/app/custom1-module/cenlib-map/cenlib-map-button.component.ts` | Button component |
| `src/app/custom1-module/cenlib-map/cenlib-map-button.component.html` | Button template |
| `src/app/custom1-module/cenlib-map/cenlib-map-button.component.scss` | Button styles |
| `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.ts` | Dialog component |
| `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.html` | Dialog template |
| `src/app/custom1-module/cenlib-map/cenlib-map-dialog/cenlib-map-dialog.component.scss` | Dialog styles |

### Phase 0 - Modify
| File | Change |
|------|--------|
| `src/app/custom1-module/customComponentMappings.ts` | Register button component |

### Phase 1 - Modify
| File | Change |
|------|--------|
| `cenlib-map-button.component.ts` | Add call number extraction |
| `cenlib-map-dialog.component.ts` | Accept dialog data |
| `cenlib-map-dialog.component.html` | Display call number |

### Phase 2 - Create
| File | Purpose |
|------|---------|
| `src/app/custom1-module/cenlib-map/config/shelf-mapping.config.ts` | Range mappings |
| `src/app/custom1-module/cenlib-map/services/shelf-mapping.service.ts` | Mapping logic |

### Phase 2 - Modify
| File | Change |
|------|--------|
| `cenlib-map-dialog.component.ts` | Use mapping service |
| `cenlib-map-dialog.component.html` | Display mapping results |

---

## Technical Notes

### NDE Insertion Point
- Using `nde-location-item-bottom` places button at the bottom of each location item
- CSS styling makes it appear inline/integrated with the row

### RTL Support
- Call numbers use `dir="ltr"` following existing pattern in `custom.css`
- Dialog respects page direction for labels

### Bilingual Labels
Button and dialog labels should support Hebrew/English based on URL `lang` parameter (can be added in Phase 0 or later refinement).

---

## Phase 3 Fix: Location Filter Not Finding Element

### Problem
Debug logs show: `[CenLib Debug] No location element found with selector [data-qa="location-sub-location"]`

The `[data-qa="location-sub-location"]` selector is not finding any elements within the `nde-location-item` parent.

### Root Cause Investigation

The issue is likely one of:
1. **DOM hierarchy**: The location sub-location element may not be inside `nde-location-item`
2. **Timing**: Element may not be rendered when `ngAfterViewInit` runs
3. **Different selector needed**: The `data-qa` attribute might be on a different element or have a different value

### Fix Strategy

#### Step 1: Broaden the search scope
Instead of searching only within `nde-location-item`, search upward to find the location element at a higher level in the DOM.

#### Step 2: Try multiple selector strategies
- Search within `nde-location-item` (current approach)
- Search within parent `nde-locations-container`
- Search for nearest ancestor with the location data

### Implementation

#### File to Modify
`src/app/custom1-module/cenlib-map/cenlib-map-button.component.ts`

#### Updated `extractLocationName` method:
```typescript
private extractLocationName(locationItem: Element): void {
  // Strategy 1: Try within locationItem
  let locationEl = locationItem.querySelector('[data-qa="location-sub-location"]');

  // Strategy 2: Try parent nde-locations-container
  if (!locationEl) {
    const locationsContainer = this.elementRef.nativeElement.closest('nde-locations-container');
    if (locationsContainer) {
      locationEl = locationsContainer.querySelector('[data-qa="location-sub-location"]');
    }
  }

  // Strategy 3: Try searching up to nde-brief-result or any parent
  if (!locationEl) {
    const briefResult = this.elementRef.nativeElement.closest('nde-brief-result');
    if (briefResult) {
      locationEl = briefResult.querySelector('[data-qa="location-sub-location"]');
    }
  }

  // DEBUG: Log what we found
  console.log('[CenLib Debug] Location element search results:', {
    withinLocationItem: locationItem.querySelector('[data-qa="location-sub-location"]'),
    strategy: locationEl ? 'found' : 'not found'
  });

  if (locationEl) {
    this.locationName = locationEl.textContent?.trim() || '';
    console.log('[CenLib Debug] Extracted location text:', `"${this.locationName}"`);
  }
}
```

#### Alternative: Log full DOM structure for analysis
Add temporary debug to see the full DOM structure:
```typescript
private extractLocationName(locationItem: Element): void {
  // DEBUG: Log the full locationItem HTML to see its structure
  console.log('[CenLib Debug] locationItem outerHTML:', locationItem.outerHTML);

  // DEBUG: Log all elements with data-qa attributes
  const allDataQa = locationItem.querySelectorAll('[data-qa]');
  console.log('[CenLib Debug] All data-qa elements in locationItem:',
    Array.from(allDataQa).map(el => ({
      dataQa: el.getAttribute('data-qa'),
      text: el.textContent?.trim()
    }))
  );

  // ... rest of extraction logic
}
```

### Verification Steps
1. Run `npm run start:proxy`
2. Open browser console
3. Navigate to an item with physical holdings
4. Check console for debug output showing:
   - The DOM structure of `locationItem`
   - All `data-qa` attributes present
   - Which strategy found the element (if any)
5. Use the debug output to identify the correct selector

### Expected Outcome
Debug logs will reveal:
- Whether `data-qa="location-sub-location"` exists at all
- Where in the DOM hierarchy it's located
- The correct selector path to use

### Files Summary
| File | Change |
|------|--------|
| `cenlib-map-button.component.ts` | Update `extractLocationName` to try multiple search strategies and log DOM structure |

---

## Phase 3 Fix: RESOLVED ✅

### Resolution Date
2026-01-15

### Root Cause
The `data-qa="location-sub-location"` element is **NOT** inside `nde-location-item`. It exists in a parent `nde-locations-container` element, outside the scope of the original search.

### Working Solution
**Strategy 2** was successful - searching within `nde-locations-container`:

```typescript
const locationsContainer = this.elementRef.nativeElement.closest('nde-locations-container');
if (locationsContainer) {
  locationEl = locationsContainer.querySelector('[data-qa="location-sub-location"]');
}
```

### Debug Output (Verified Working)
```
[CenLib Debug] All data-qa elements in locationItem: []
[CenLib Debug] Found location via Strategy 2 (nde-locations-container)
[CenLib Debug] Extracted location text: "Reading room 1 A - 1st floor;"
[CenLib Debug] Filter config: {enabled: true, allowedLocations: Array(2), matchType: exact}
[CenLib Debug] Exact match result: true
[CenLib Debug] Final shouldShow: true
```

### Verification Results
- ✅ Location element found via Strategy 2
- ✅ Location text extracted correctly
- ✅ Filter matching works (exact match)
- ✅ Button appears for configured locations
- ✅ Dialog opens with correct call number mapping

### Key Insight
The NDE DOM structure places `location-sub-location` in a parent container rather than within each `location-item`. This is likely because the location name is shared across all items in that location, not repeated per item.

---

## Future Phases (Reference Only)

- **Phase 4**: SVG map rendering - display actual floor map with highlighted shelf
- **Phase 5**: Production polish - accessibility, analytics, multiple library support
