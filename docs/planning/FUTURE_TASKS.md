# Future Tasks and Enhancements

This document tracks planned enhancements and future work for the TAU CustomModule.

**Status Legend:**
- 📋 Planned - Not yet started
- 🚧 In Progress - Currently being worked on
- ✅ Completed - Done and merged
- ⏸️ On Hold - Paused for specific reason

---

## CenLib Shelf-Map — Multi-library support (second library: Neiman)

### ⏸️ Onboard a second library into the Shelf-Map feature
**Priority:** Medium
**Status:** ⏸️ On Hold — pending a concrete decision from the Neiman Library (it is **not yet certain they will migrate to the service**).
**Estimated Effort:** Large (producer retrofit + map/data authoring; see assessment)
**Tracking:** GitHub issue #27

#### What exists
A full cross-repo design (producer `primo_maps` + this consumer) is written and committed:
- **Design spec:** [`docs/superpowers/specs/2026-07-13-primo-maps-multi-library-design.md`](../superpowers/specs/2026-07-13-primo-maps-multi-library-design.md)
- **Work assessment dashboard:** [`docs/dashboards/add-second-library-assessment.html`](../dashboards/add-second-library-assessment.html)
- Both landed on **PR #26**.

#### Decision (in the spec)
**"Separate all the way"** — per-library files end-to-end (per-library CSV + SVGs + versions + staging in the producer; consumer fetches each library's CSV in parallel and merges). No assemble step. Includes a library registry + library-scoped auth + active-library switcher, and a no-outage Sourasky migration.

#### Resume when
The Neiman Library commits to migrating. Next step is the implementation plan (writing-plans). Open items first: confirm Neiman's floor numbers, capture its exact NDE DOM strings, and author its floor SVGs + CSV rows (see spec §9).

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

## User Support Integration

### 📋 Personalized WhatsApp Support Links
**Priority:** Medium
**Status:** 📋 Planned - Needs Testing
**Estimated Effort:** Medium (2-4 days)

#### Background
TAU's five main libraries provide support via WhatsApp. Previous implementation required users to manually select their library from a list, which was unintuitive.

**Inspiration:** LibraryH3lp chat widget implementation (see [ExLibris commit f216d17](https://github.com/ExLibrisGroup/customModule/commit/f216d17ae40e19bb8d571bc3ccb6fe9c7c9fd698))

#### Proposed Enhancement
Create a component that automatically detects authenticated user's library affiliation and presents them with a personalized WhatsApp link to their specific library's support.

**User Flow:**
1. **Authenticated Users** → Show single WhatsApp button for their affiliated library
2. **Unauthenticated Users** → Show all 5 library options OR prompt to log in

#### Implementation Requirements

##### 1. User Data Access
**Need to determine:**
- [ ] Which Primo/Alma API endpoint provides user profile data?
- [ ] Which field contains library/faculty affiliation? (e.g., `userGroup`, `department`, `campus`, `homeLibrary`)
- [ ] Is this data available in the user session/token?
- [ ] What are the possible values for each library?

##### 2. Library Mapping
Create mapping between user affiliation values and WhatsApp contact URLs:

```typescript
interface LibraryWhatsAppConfig {
  id: string;
  name: { en: string; he: string };
  affiliationValues: string[];  // Possible values from user profile
  whatsappUrl: string;
}

// Example mapping (values TBD):
const LIBRARY_WHATSAPP_MAP: LibraryWhatsAppConfig[] = [
  {
    id: 'sourasky',
    name: { en: 'Sourasky Central Library', he: 'ספריית שורסקי המרכזית' },
    affiliationValues: ['CENTRAL', 'SOURASKY'],
    whatsappUrl: 'https://wa.me/...'
  },
  // ... other 4 libraries
];
```

##### 3. Component Implementation
**Similar to LibraryH3lp approach:**
- Angular standalone component
- Check authentication state
- Fetch user profile if authenticated
- Display appropriate WhatsApp link(s)
- Configurable positioning (floating button, slot, etc.)

```typescript
// libraryh3lp-whatsapp/whatsapp-support.component.ts
export class WhatsAppSupportComponent implements OnInit {
  userLibrary?: LibraryWhatsAppConfig;
  isAuthenticated = false;
  allLibraries = LIBRARY_WHATSAPP_MAP;

  async ngOnInit() {
    this.isAuthenticated = await this.checkAuth();
    if (this.isAuthenticated) {
      const userProfile = await this.fetchUserProfile();
      this.userLibrary = this.mapAffiliationToLibrary(userProfile);
    }
  }
}
```

##### 4. Configuration Options
**Potentially move to Alma Code Tables (similar to External Search):**
- WhatsApp URLs for each library
- Library names (i18n)
- Affiliation mapping values
- Enable/disable per library
- Component positioning and styling

#### Data Needed

**Before Implementation:**
1. **WhatsApp URLs** - Get 5 WhatsApp contact/group links from library staff
2. **User Profile API** - Test which endpoint provides user data
3. **Affiliation Field** - Determine exact field name and possible values
4. **Library Values** - Map each library to its affiliation value(s)

#### Edge Cases to Handle
- [ ] User with no affiliation data → Show all options
- [ ] User with multiple affiliations → Show all relevant libraries
- [ ] User from non-main library → Default behavior TBD
- [ ] API failure → Graceful fallback to showing all options
- [ ] Unauthenticated users → Show all options or login prompt

#### Testing Requirements

**Functional Testing:**
- [ ] Authenticated user sees correct library WhatsApp link
- [ ] Unauthenticated user sees appropriate fallback
- [ ] WhatsApp links open correctly (mobile vs desktop)
- [ ] Multiple affiliations handled correctly
- [ ] No affiliation handled correctly
- [ ] API error handling works
- [ ] Component displays correctly on different screen sizes

**User Affiliation Testing:**
- [ ] Test with user from each of the 5 main libraries
- [ ] Test with user from satellite library
- [ ] Test with faculty/staff vs student accounts
- [ ] Test with guest/external user accounts

**Authentication Testing:**
- [ ] Component works in logged-out state
- [ ] Component updates after user logs in
- [ ] Component updates after user logs out
- [ ] Session timeout handled correctly

#### Files to Create/Modify
- 📝 `src/app/custom1-module/whatsapp-support/whatsapp-support.component.ts` (NEW)
- 📝 `src/app/custom1-module/whatsapp-support/whatsapp-support.component.html` (NEW)
- 📝 `src/app/custom1-module/whatsapp-support/whatsapp-support.component.scss` (NEW)
- 📝 `src/app/custom1-module/whatsapp-support/whatsapp-support.component.spec.ts` (NEW)
- 📝 `src/app/custom1-module/whatsapp-support/config/library-mapping.config.ts` (NEW)
- 📝 `bootstrapTAU-WhatsAppSupport.ts` (NEW - if standalone add-on)
- 📝 `docs/features/whatsapp-support/IMPLEMENTATION.md` (NEW)
- 📝 `build-settings.env` (update if needed)

#### Benefits
✅ **Better UX** - Users don't need to know/select their library
✅ **Faster Support Access** - One click to appropriate contact
✅ **Familiar Platform** - WhatsApp is widely used
✅ **Personalized** - Leverages authentication data
✅ **Scalable** - Easy to add/modify library contacts

#### Questions to Resolve
- [ ] Should this be a standalone add-on or integrated into existing custom module?
- [ ] What should unauthenticated users see? All options or login prompt?
- [ ] Mobile vs desktop behavior differences?
- [ ] Should this replace existing WhatsApp links or complement them?
- [ ] Analytics tracking for WhatsApp clicks?

#### Related Work
- Previous WhatsApp integration (location/implementation TBD)
- LibraryH3lp commit: https://github.com/ExLibrisGroup/customModule/commit/f216d17ae40e19bb8d571bc3ccb6fe9c7c9fd698

---

## General Improvements

### 📋 Consider Adding Generated Files to .gitignore
**Priority:** Low
**Status:** 📋 Planned - Needs Decision
**Estimated Effort:** Low (5 minutes)

#### Background
The file `src/app/state/asset-base.generated.ts` is auto-generated by `prebuild.js` from `build-settings.env`, but it's currently tracked in git.

**Recent Issue (2025-11-18):**
- `build-settings.env` was updated to use `VIEW_ID=NDE_TEST`
- Generated file wasn't regenerated, still had old value for production view
- This caused a mismatch that would break asset loading (404 errors)

#### Proposal
Add `src/app/state/asset-base.generated.ts` to `.gitignore` so it's always generated fresh.

#### Pros
✅ **Prevents sync issues** - File always matches `build-settings.env`
✅ **Cleaner commits** - No more committing generated files
✅ **Forces regeneration** - Developers must run prebuild, ensuring freshness

#### Cons
⚠️ **Requires discipline** - Developers must remember to run `node prebuild.js` or `npm run build`
⚠️ **Not automatic for dev** - `npm start` doesn't auto-run prebuild (only `npm run build` does via `"prebuild"` script)
⚠️ **Initial setup** - New contributors must generate file before first run

#### Decision Needed
Should we prioritize:
- **Safety** (never out of sync) → Add to .gitignore
- **Convenience** (works out of box) → Keep in git

#### Implementation
If decided to proceed:
1. Add line to `.gitignore`: `src/app/state/asset-base.generated.ts`
2. Update developer setup documentation
3. Consider adding `prestart` script if not already present
4. Document in `README.md` or `CONTRIBUTING.md`

#### Related
- `CLAUDE.md` now has "Critical Build Requirements" section documenting the prebuild requirement
- `prebuild.js:56-63` - Script that generates this file
- `package.json:14` - `"prebuild"` script runs before build

---

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

### ✅ Research Assistant Text Customization (REMOVED)
**Completed:** 2025-11-13
**Removed:** 2025-11-16
**Branch:** `main`
Implemented shadow DOM manipulation for Research Assistant description text.
**Note:** Feature has been removed from the codebase. Documentation archived to `docs/archived/research-assistant/`.

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
