# External Links in No Results Tile – Implementation Plan

## Overview
Implement an Angular 18 component that displays external search links (ULI, WorldCat, Google Scholar) when no results are found, replacing the legacy AngularJS `prmNoSearchResultAfter` implementation.

## Current Legacy Implementation Analysis
The existing code (lines 172-208 in `external_sources_feature.txt`):
- Component: `prmNoSearchResultAfter`
- Retrieves search term from `parentCtrl.term`
- Builds language-specific links (EN/HE) to 3 external sources
- Uses hardcoded image paths: `custom/972TAU_INST-TAU/img/...`
- Uses translate directives for labels
- Renders as an md-card with 3 link paragraphs

## Prerequisites (Already Completed)
✓ SearchQueryService implemented - extracts queries, filters, and search term from URL
✓ EXTERNAL_SEARCH_SOURCES config with search targets (ULI, WorldCat, Google Scholar)
✓ Query normalization and URL building logic (buildSearchQuery function)
✓ Asset images migrated to `src/assets/images/external-sources/`
✓ AutoAssetSrcDirective for asset path resolution

## Implementation Approach (Based on Existing Code)

**Translation**: Inline string literals with getter methods (NO external i18n library)
**Language Detection**: Via `SearchQueryService.getCurrentLanguage()` from URL `?lang=he`
**Search Term Access**: Via `SearchQueryService.getSearchData()` from URL `?query=...`
**Component Registration**: Add to `customComponentMappings.ts` Map
**Selector Pattern**: `nde-[element]-after` (following existing pattern)

## Implementation Steps

### 1. Identify NDE No-Results Selector ✓ RESOLVED
**Goal**: Confirm the correct selector for injecting components in the no-results area.

**Finding from DOM inspection** (`docs/reference/nde_no_results_html.txt`):
- Main element: `<nde-search-no-results>`
- Search term visible in line 12: `"There are no results matching your search "testfadfagddag"."`
- **Target selector**: `nde-search-no-results-after` (to insert after no-results content)

**Search term access**:
- Use existing `SearchQueryService.getSearchData()` which reads from URL params
- Already tested and working in FilterAssistPanelComponent

**Validation**: ✓ Complete
- Selector confirmed from HTML dump
- Search data available via existing service

---

### 2. Create NoResultsExternalLinksComponent (1 day)

**Goal**: Build Angular component to display external search links.

#### 2.1 Generate Component
```bash
ng generate component components/no-results-external-links --skip-tests=false
```

**File Structure**:
```
src/app/components/no-results-external-links/
├── no-results-external-links.component.ts
├── no-results-external-links.component.html
├── no-results-external-links.component.scss
└── no-results-external-links.component.spec.ts
```

#### 2.2 Component Implementation

**Component Class** (`no-results-external-links.component.ts`):
```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';
import { SearchTarget, SearchQuery } from '../filter-assist-panel/models/search-target.model';
import { EXTERNAL_SEARCH_SOURCES } from '../filter-assist-panel/config/external-sources.config';
import { AutoAssetSrcDirective } from '../../services/auto-asset-src.directive';

/**
 * No Results External Links Component
 * Displays external search links when no results are found
 * Reuses same config and services as FilterAssistPanelComponent
 */
@Component({
  selector: 'tau-no-results-external-links',
  standalone: true,
  imports: [CommonModule, AutoAssetSrcDirective],
  templateUrl: './no-results-external-links.component.html',
  styleUrls: ['./no-results-external-links.component.scss']
})
export class NoResultsExternalLinksComponent implements OnInit {
  /** List of external search sources from shared config */
  externalSources: SearchTarget[] = EXTERNAL_SEARCH_SOURCES;

  /** Current UI language */
  currentLanguage: 'en' | 'he' = 'en';

  /** Parsed search data from URL */
  searchData: SearchQuery = {
    queries: [],
    filters: [],
    searchTerm: ''
  };

  /** Text direction based on language */
  get textDirection(): 'ltr' | 'rtl' {
    return this.currentLanguage === 'he' ? 'rtl' : 'ltr';
  }

  /** Card title based on language */
  get cardTitle(): string {
    return this.currentLanguage === 'he'
      ? 'נסה לחפש במקורות חיצוניים'
      : 'Try searching in external sources';
  }

  constructor(private searchQueryService: SearchQueryService) {}

  ngOnInit(): void {
    // Detect current language from URL
    this.currentLanguage = this.searchQueryService.getCurrentLanguage();

    // Extract search data from URL
    this.searchData = this.searchQueryService.getSearchData();

    console.log('NoResultsExternalLinks initialized:', {
      language: this.currentLanguage,
      searchData: this.searchData
    });
  }

  /**
   * Build complete URL for external search source
   * Combines base URL with mapped query parameters
   * @param source External search target
   * @returns Complete URL with encoded search query
   */
  buildExternalUrl(source: SearchTarget): string {
    try {
      // Use the source's mapping function to format the query
      const mappedQuery = source.mapping(
        this.searchData.queries,
        this.searchData.filters
      );

      // Combine base URL with mapped query
      return `${source.url}${mappedQuery}`;
    } catch (e) {
      console.error(`Error building URL for ${source.name}:`, e);
      // Fallback: use simple search term
      return `${source.url}${encodeURIComponent(this.searchData.searchTerm)}`;
    }
  }

  /**
   * Get source name in current language
   * @param source External search target
   * @returns Localized source name
   */
  getSourceName(source: SearchTarget): string {
    return this.currentLanguage === 'he' ? source.nameHe : source.name;
  }

  /**
   * Check if we have a valid search query to display links
   * @returns True if search data is available
   */
  hasSearchQuery(): boolean {
    return this.searchData.queries.length > 0 || this.searchData.searchTerm.length > 0;
  }
}
```

**Template** (`no-results-external-links.component.html`):
```html
<div
  class="no-results-external-links"
  [attr.dir]="textDirection"
  *ngIf="hasSearchQuery()"
  role="complementary"
  aria-label="External search options">

  <div class="card-container">
    <h3 class="card-title">
      {{ cardTitle }}:
    </h3>

    <ul class="external-links-list" role="list">
      <li *ngFor="let source of externalSources" class="link-item">
        <a
          [href]="buildExternalUrl(source)"
          target="_blank"
          rel="noopener noreferrer"
          class="link"
          [attr.aria-label]="'Search in ' + getSourceName(source) + ' (opens in new window)'">

          <img
            autoAssetSrc
            [src]="source.img"
            [alt]="source.alt"
            class="link-icon"
            width="16"
            height="16">

          <span class="link-label">
            {{ getSourceName(source) }}
          </span>

          <svg
            class="external-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="currentColor"
            aria-hidden="true">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
        </a>
      </li>
    </ul>
  </div>
</div>
```

**Styling** (`no-results-external-links.component.scss`):
```scss
.no-results-external-links {
  margin: 16px 0;

  .card-container {
    background: #ffffff;
    border-radius: 4px;
    padding: 16px 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 500;
    color: #424242;
    line-height: 1.5;
  }

  .external-links-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .link-item {
    margin: 0;
    padding: 0;
  }

  .link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: #1976d2;
    padding: 6px 0;
    transition: color 0.2s ease;

    &:hover {
      color: #0d47a1;
      text-decoration: underline;
    }

    &:focus {
      outline: 2px solid #1976d2;
      outline-offset: 2px;
      border-radius: 2px;
    }

    &:visited {
      color: #7b1fa2;
    }
  }

  .link-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: block;
  }

  .link-label {
    font-size: 14px;
    line-height: 1.4;
    flex: 1;
  }

  .external-icon {
    flex-shrink: 0;
    opacity: 0.6;
    margin-inline-start: 4px;
  }

  // RTL support - use logical properties for better RTL handling
  &[dir="rtl"] {
    .link {
      flex-direction: row-reverse;
    }

    .external-icon {
      transform: scaleX(-1); // Flip icon in RTL
    }
  }
}
```

---

### 3. Register Component in customComponentMappings (0.25 days)

**Goal**: Make component available in NDE no-results area.

**Update** `src/app/custom1-module/customComponentMappings.ts`:
```typescript
import { FilterAssistPanelComponent } from './filter-assist-panel/filter-assist-panel.component';
import { NoResultsExternalLinksComponent } from './no-results-external-links/no-results-external-links.component';

// Define the map of custom element selectors -> Angular components
export const selectorComponentMap = new Map<string, any>([
  ['nde-filters-group-before', FilterAssistPanelComponent],
  ['nde-search-no-results-after', NoResultsExternalLinksComponent],
]);
```

**Note**:
- Selector `nde-search-no-results-after` confirmed from HTML inspection
- Component will be inserted after the `<nde-search-no-results>` element

---

### 4. Translation Support ✓ NOT NEEDED

**Approach**: Following FilterAssistPanelComponent pattern.

**Implementation**:
- ✓ Inline string literals with getter methods (e.g., `cardTitle` getter)
- ✓ Language detection via `SearchQueryService.getCurrentLanguage()`
- ✓ Bilingual labels stored in `EXTERNAL_SEARCH_SOURCES` config (`name` / `nameHe`)
- ✓ Component method `getSourceName()` selects appropriate label

**No external translation library needed** - consistent with existing approach.

---

### 5. Testing (1 day)

#### 5.1 Unit Tests

**Test** `no-results-external-links.component.spec.ts`:
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoResultsExternalLinksComponent } from './no-results-external-links.component';
import { SearchQueryService } from '../filter-assist-panel/services/search-query.service';

describe('NoResultsExternalLinksComponent', () => {
  let component: NoResultsExternalLinksComponent;
  let fixture: ComponentFixture<NoResultsExternalLinksComponent>;
  let mockSearchQueryService: jasmine.SpyObj<SearchQueryService>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('SearchQueryService', [
      'getCurrentLanguage',
      'getSearchData'
    ]);

    await TestBed.configureTestingModule({
      imports: [ NoResultsExternalLinksComponent ], // standalone component
      providers: [
        { provide: SearchQueryService, useValue: serviceSpy }
      ]
    }).compileComponents();

    mockSearchQueryService = TestBed.inject(SearchQueryService) as jasmine.SpyObj<SearchQueryService>;
    fixture = TestBed.createComponent(NoResultsExternalLinksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display Hebrew title when language is Hebrew', () => {
    mockSearchQueryService.getCurrentLanguage.and.returnValue('he');
    mockSearchQueryService.getSearchData.and.returnValue({
      queries: ['any,contains,test,AND'],
      filters: [],
      searchTerm: 'test'
    });

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.cardTitle).toBe('נסה לחפש במקורות חיצוניים');
  });

  it('should display English title when language is English', () => {
    mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
    mockSearchQueryService.getSearchData.and.returnValue({
      queries: ['any,contains,test,AND'],
      filters: [],
      searchTerm: 'test'
    });

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.cardTitle).toBe('Try searching in external sources');
  });

  it('should set RTL direction for Hebrew', () => {
    mockSearchQueryService.getCurrentLanguage.and.returnValue('he');
    mockSearchQueryService.getSearchData.and.returnValue({
      queries: ['any,contains,test,AND'],
      filters: [],
      searchTerm: 'test'
    });

    component.ngOnInit();

    expect(component.textDirection).toBe('rtl');
  });

  it('should build correct external URLs', () => {
    mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
    mockSearchQueryService.getSearchData.and.returnValue({
      queries: ['any,contains,quantum physics,AND'],
      filters: [],
      searchTerm: 'quantum physics'
    });

    component.ngOnInit();

    const source = component.externalSources[0]; // ULI
    const url = component.buildExternalUrl(source);

    expect(url).toContain('uli.nli.org.il');
    expect(url).toContain('quantum');
  });

  it('should return Hebrew source name when language is Hebrew', () => {
    component.currentLanguage = 'he';
    const source = { name: 'ULI', nameHe: 'הקטלוג המאוחד' } as any;

    expect(component.getSourceName(source)).toBe('הקטלוג המאוחד');
  });

  it('should not render when no search query', () => {
    mockSearchQueryService.getCurrentLanguage.and.returnValue('en');
    mockSearchQueryService.getSearchData.and.returnValue({
      queries: [],
      filters: [],
      searchTerm: ''
    });

    component.ngOnInit();

    expect(component.hasSearchQuery()).toBe(false);
  });
});
```

#### 5.2 Integration Testing

**Manual Test Checklist**:
- [ ] Component appears when search returns 0 results
- [ ] Links contain correct search term (test with English query)
- [ ] Links contain correct search term (test with Hebrew query)
- [ ] Links open in new tab with correct URLs
- [ ] Component displays in RTL mode when lang=he
- [ ] Component displays in LTR mode when lang=en
- [ ] Icons load correctly via AutoAssetSrcDirective
- [ ] All 3 external sources visible (ULI, WorldCat, Google Scholar)
- [ ] Component styling matches Primo NDE design system
- [ ] Accessibility: Links have proper aria-labels
- [ ] Keyboard navigation works (tab through links, Enter to activate)

**Test Scenarios**:
1. Simple search with no results: `?query=any,contains,xyznonexistent,AND`
2. Hebrew search with no results: `?query=any,contains,בדיקה123,AND&lang=he`
3. Advanced search with multiple fields and no results

---

### 6. Documentation (0.25 days)

**Update** `SPECS.md`:
```markdown
## No Results External Links Component

**Location**: `src/app/custom1-module/no-results-external-links/`

**Purpose**: Displays links to external search sources when Primo NDE search returns zero results.

**Selector Registration**: `nde-search-no-results-after` in `customComponentMappings.ts`

**Dependencies**:
- `SearchQueryService`: Extracts search query and language from URL
- `EXTERNAL_SEARCH_SOURCES`: Shared config with FilterAssistPanelComponent
- `AutoAssetSrcDirective`: Resolves asset paths for icons

**Configuration**: Shares `src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts` with facet.

**Supported Languages**: English, Hebrew (RTL support via inline getters)

**Translation**: Inline string literals (no external i18n library)

**Customization**:
To add/remove external sources, edit `filter-assist-panel/config/external-sources.config.ts`.
Changes will apply to both facet panel and no-results component.
```

**Update** `README.md` (external search section):
```markdown
### External Search - No Results Links

When a search returns no results, the system displays a card with links to external sources:
- ULI (Union List of Israel)
- WorldCat
- Google Scholar

The links automatically include the user's search query, properly encoded and formatted for each target system.

**Features**:
- Bilingual support (English/Hebrew) with automatic RTL layout
- Opens links in new tab with security attributes (`rel="noopener noreferrer"`)
- Accessible keyboard navigation
- Visual "external link" indicator icon

**Customization**: Edit `src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts` to modify target sources. The configuration is shared with the filter assist panel facet.
```

---

## Implementation Checklist

- [x] **Step 1**: Identify and document NDE no-results selector ✓
  - [x] Confirmed: `nde-search-no-results-after`
  - [x] Search term access via `SearchQueryService.getSearchData()`
- [ ] **Step 2**: Generate and implement `NoResultsExternalLinksComponent`
  - [ ] Component class with SearchQueryService injection
  - [ ] HTML template with dynamic links and external icon
  - [ ] SCSS styling with RTL support and card design
  - [ ] Use standalone component pattern
- [ ] **Step 3**: Register component in `customComponentMappings.ts`
- [ ] **Step 4**: Write and run unit tests
  - [ ] Test language detection
  - [ ] Test URL building
  - [ ] Test RTL/LTR direction
  - [ ] Test conditional rendering
- [ ] **Step 5**: Perform manual integration testing
  - [ ] Test with English queries (no results)
  - [ ] Test with Hebrew queries (no results)
  - [ ] Verify link URLs open correctly
  - [ ] Test accessibility (keyboard, screen reader)
- [ ] **Step 6**: Update documentation (SPECS.md, README.md)
- [ ] **Step 7**: Build and verify in local NDE environment
- [ ] **Step 8**: Code review and cleanup

---

## Estimated Timeline
- **Total**: 2 - 2.5 days (reduced from 4 days due to reusing existing infrastructure)
  - ~~Discovery & Planning: 0.5 days~~ ✓ Complete
  - Component Development: 1 day
  - ~~Service Updates: 0.5 days~~ ✓ Not needed
  - Integration: 0.25 days
  - ~~Translation Setup: 0.5 days~~ ✓ Not needed
  - Testing: 0.75 days
  - Documentation: 0.25 days
  - Buffer/Review: 0.25 days

---

## Resolved Questions ✓
1. ~~**Exact NDE selector**~~ ✓ Confirmed: `nde-search-no-results-after`
2. ~~**Search term access**~~ ✓ Via URL params using existing `SearchQueryService`
3. ~~**Translation approach**~~ ✓ Inline string literals with getters (matching FilterAssistPanelComponent)
4. **Styling**: Will use custom card design similar to NDE style but branded for external links

---

## Success Criteria
- ✓ Component renders only when search query exists and results count = 0
- ✓ All 3 external links display with correct icons
- ✓ Links contain properly encoded search term
- ✓ Hebrew/English labels display based on interface language (`?lang=he`)
- ✓ RTL layout applies when `lang=he`
- ✓ Links open in new tab/window with security attributes
- ✓ Unit tests achieve >80% coverage
- ✓ Manual tests pass for all scenarios (EN/HE, various queries)
- ✓ No console errors or warnings
- ✓ Accessible via keyboard navigation (tab, enter)
- ✓ Documentation updated (SPECS.md, README.md)

---

## Design Notes
- **Maximum code reuse**: Component mirrors FilterAssistPanelComponent structure
- **Shared configuration**: Both components use `filter-assist-panel/config/external-sources.config.ts`
- **Consistent patterns**: Same service injection, same translation approach, same styling patterns
- **Future optimization**: Could extract shared link rendering logic into a presentational component if more external link features are added
