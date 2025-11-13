# Future Tasks and Enhancements

This document tracks planned enhancements and future work for the TAU CustomModule.

**Status Legend:**
- 📋 Planned - Not yet started
- 🚧 In Progress - Currently being worked on
- ✅ Completed - Done and merged
- ⏸️ On Hold - Paused for specific reason

---

## External Search Integration

### 📋 Move Configuration to Alma Code Tables
**Priority:** Medium
**Status:** 📋 Planned
**Estimated Effort:** Medium (2-3 days)

#### Current State
External search sources (ULI, WorldCat, Google Scholar) are currently hard-coded in:
```
src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts
```

Each source includes:
- Name (English and Hebrew) - Hard-coded strings
- URL template - Hard-coded string
- Icon path - Hard-coded relative path
- Query mapping function - Hard-coded in TypeScript

**Problem:** Any changes to sources (adding/removing/modifying) require:
1. Code changes
2. Rebuild of the package
3. Redeployment to Alma
4. Testing in production environment

#### Proposed Enhancement
Move configurable values to **Alma NDE Code Tables** to enable library staff to manage external sources without code changes.

**Values to Move to Code Tables:**

| Configuration Item | Current Location | Proposed Location | Example |
|-------------------|------------------|-------------------|---------|
| Source Names (i18n) | TypeScript config | Alma NDE Code Table | `nde-ext-search-uli-name` |
| Source Descriptions | TypeScript config | Alma NDE Code Table | `nde-ext-search-uli-desc` |
| Base URLs | TypeScript config | Alma NDE Code Table | `nde-ext-search-uli-url` |
| Icon Paths | TypeScript config | Alma NDE Code Table | `nde-ext-search-uli-icon` |
| Source Enabled/Disabled | Not configurable | Alma NDE Code Table | `nde-ext-search-uli-enabled` |
| Display Order | Array order | Alma NDE Code Table | `nde-ext-search-uli-order` |

#### Benefits
✅ **No Code Changes Required** - Library staff can manage sources through Alma UI
✅ **Faster Iteration** - Add/remove sources without rebuild/redeploy
✅ **Multiple Environments** - Different configs for TEST vs PROD
✅ **Non-Technical Management** - No programming knowledge needed
✅ **Instant Updates** - Changes reflect immediately after cache clear
✅ **Audit Trail** - Alma tracks who changed what and when

#### Implementation Approach

##### 1. Design Code Table Structure
Create a naming convention for code table keys:

```
Pattern: nde-ext-search-{source-id}-{property}

Examples:
- nde-ext-search-uli-name-en: "ULI"
- nde-ext-search-uli-name-he: "מאגר איחוד"
- nde-ext-search-uli-desc-en: "Union List of Israel"
- nde-ext-search-uli-desc-he: "מאגר האיחוד הישראלי"
- nde-ext-search-uli-url: "https://www.union-list.tau.ac.il/..."
- nde-ext-search-uli-icon: "assets/icons/uli-icon-16.png"
- nde-ext-search-uli-enabled: "true"
- nde-ext-search-uli-order: "1"
```

##### 2. Create Configuration Service
New service to read and parse code table values:

```typescript
// src/app/services/external-search-config.service.ts
export interface ExternalSource {
  id: string;
  name: string;
  description: string;
  url: string;
  iconPath: string;
  enabled: boolean;
  order: number;
  queryMapper: (query: string) => string;
}

@Injectable({ providedIn: 'root' })
export class ExternalSearchConfigService {
  constructor(private translateService: TranslateService) {}

  async loadSources(): Promise<ExternalSource[]> {
    // Read from code tables
    // Parse and return configured sources
  }
}
```

##### 3. Update Components
Modify both components to use the new service:
- `FilterAssistPanelComponent`
- `NoResultsExternalLinksComponent`

##### 4. Handle Query Mapping
**Challenge:** Query mapping functions can't be stored in code tables (they're code).

**Possible Solutions:**
- **Option A**: Keep query mappers in code, reference by ID
- **Option B**: Use simple string templates with placeholders: `{QUERY}`, `{ENCODED_QUERY}`
- **Option C**: Support basic transformations via config (e.g., "urlencode", "replace-spaces")

**Recommended:** Option B with Option C for common cases, fallback to Option A for complex mappings.

##### 5. Migration Strategy
1. Create all code table entries in Alma
2. Add new configuration service
3. Update components to check for code table config first, fall back to hard-coded
4. Test thoroughly in TEST environment
5. Deploy to PROD
6. Remove hard-coded config after verification

#### Technical Considerations

**Icon Paths:**
- Store relative paths in code tables: `assets/icons/uli-icon-16.png`
- Service prepends `ASSET_BASE_URL` automatically
- Icons still bundled in package (not fetched from Alma)

**Caching:**
- TranslateService caches code table values
- May need cache-busting for immediate updates
- Document for library staff

**Validation:**
- Service should validate URLs (valid format, HTTPS)
- Validate icon paths (file exists)
- Validate enabled flag (true/false)
- Validate order (numeric)

**Backwards Compatibility:**
- Keep hard-coded config as fallback
- Service checks code tables first
- Falls back to hard-coded if code table empty

**Error Handling:**
- Log warnings if code table values invalid
- Fall back to hard-coded config on error
- Don't break the UI if config missing

#### Files to Modify
- ✏️ `src/app/services/external-search-config.service.ts` (NEW)
- ✏️ `src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.ts`
- ✏️ `src/app/custom1-module/no-results-external-links/no-results-external-links.component.ts`
- ✏️ `src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts` (keep as fallback)
- 📝 `docs/features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md` (update)
- 📝 `docs/features/external-search/ALMA_CODE_TABLE_CONFIG.md` (NEW)

#### Testing Checklist
- [ ] All sources load from code tables
- [ ] Fallback to hard-coded works if code tables empty
- [ ] Icons display correctly with configured paths
- [ ] URLs work with query parameters
- [ ] Language switching updates source names/descriptions
- [ ] Enabled/disabled flag works
- [ ] Display order respected
- [ ] Both components (filter panel + no results) work
- [ ] Error handling works for invalid config

#### Documentation Needed
- Configuration guide for library staff
- Code table key reference table
- Migration guide from hard-coded to code table
- Troubleshooting guide

#### Related Files
- `src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts`
- `src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.ts`
- `src/app/custom1-module/no-results-external-links/no-results-external-links.component.ts`
- `docs/features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md`

#### Reference
- Research Assistant component already uses custom Alma labels successfully
- Similar pattern can be applied here
- TranslateService: `this.translateService.get('code-table-key').toPromise()`

---

## Research Assistant

### 📋 Additional Future Enhancements
_Placeholder for future Research Assistant tasks_

---

## CSS Customizations

### 📋 Call Number Directionality - Additional Cases
**Priority:** Low
**Status:** 📋 Planned
**Branch:** `call_no_directionality` (kept open for this purpose)

#### Context
Currently implemented two locations for call number directionality fix:
1. `nde-locations-container [data-qa="location-call-number"]`
2. `nde-location-item .getit-items-brief-property:nth-child(3)`

**Task:** Monitor for additional locations where call numbers appear and may need LTR directionality fix.

**Action:** Add new CSS rules to `src/assets/css/custom.css` as cases are discovered.

**Documentation:** Update `docs/reference/call_number_directionality_fix.md` with each new case.

---

## General Improvements

### 📋 Performance Optimization
_Track performance-related improvements_

### 📋 Accessibility Enhancements
_Track WCAG compliance and a11y improvements_

### 📋 Testing
_Track testing needs (unit tests, e2e tests)_

---

## Completed Tasks

### ✅ External Search Integration Migration
**Completed:** 2025-11-11
**Branch:** `main`
Migrated external search features from AngularJS to Angular 18.

### ✅ Research Assistant Text Customization
**Completed:** 2025-11-13
**Branch:** `main`
Implemented shadow DOM manipulation for Research Assistant description text.

### ✅ Call Number Directionality Fix (Initial)
**Completed:** 2025-11-13
**Branch:** `main`
Implemented CSS fixes for two call number locations.

---

## Notes

- Keep this document updated as tasks are completed or priorities change
- Link to GitHub issues when created
- Use clear status indicators
- Include enough context for future reference
- Update related documentation when tasks are completed
