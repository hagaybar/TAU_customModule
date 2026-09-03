# TAU CustomModule for Primo NDE

### Overview
This is Tel Aviv University's customization package for Primo's New Discovery Experience (NDE). It extends the base ExLibris customModule with TAU-specific features and enhancements.

---

## 📋 Summary of TAU Customizations

This package includes the following Tel Aviv University-specific customizations, grouped by
the kind of work involved. The **add-ons / components** are the substantial engineering — custom
Angular components (and, for the shelf map, a companion data pipeline). The **styling tweaks** are
lightweight CSS/asset overrides.

### 🧩 Add-ons & components (custom application code)

| Feature | Status | Description |
|---------|--------|-------------|
| **External Search Integration** | ✅ Production | Search-links panel (filter sidebar) + external links on the no-results page — components with query mapping and bilingual RTL support |
| **CenLib Shelf Map** | ✅ Production | Interactive "Shelf Map" button + floor-plan dialog that pinpoints an item on the shelf. Data-driven from a companion **Primo Maps** repo (`NDE_MAPS_MANGER`) via an AWS CloudFront CDN |
| **Announcement Banner** | ✅ Production | Dismissible bilingual strip above the NDE header, announcing the refreshed look |

### 🎨 CSS & styling tweaks (lightweight overrides)

| Tweak | Type | Status | Description |
|-------|------|--------|-------------|
| **Call Number Directionality** | CSS | ✅ Production | LTR display + bold styling for mixed-language call numbers |
| **Location Availability Color** | CSS | ✅ Production | Green text for availability status |
| **Card Title Styling** | CSS | ✅ Production | Bold card titles |
| **Hide Update Login Credentials** | CSS | ✅ Production | Hide card actions in MyAccount area |
| **Bilingual Logo** | CSS | ✅ Production | Language-specific library logo (EN/HE) swapped via `lang`/`dir` |
| **Bilingual Search Background** | CSS | ✅ Production | Language-specific homepage search banner (EN/HE) |
| **Landing Page Banner Override** | CSS | ✅ Production | Repaint the native landing-page image overlay (added by Ex Libris) per-language so the custom banner isn't hidden |
| **Advanced Search Link Bold** | CSS | ✅ Production | Bold the "Advanced search" link (EN + HE) |
| **Landing "About" Bullet Fix** | CSS | ✅ Production | Hide stray empty checkmark bullets in the landing "About" box |
| **Resource-Type Pill Chip** | CSS | ✅ Production | Render the results-page resource type ("Journal", "ספר") as a filled pill instead of plain text |
| **Search-Bar Band** | CSS | ✅ Production | Solid blue band behind the search bar on the results and full-record pages, so the near-white search box reads as its own element |
| **Landing Search-Bar Flash Suppression** | CSS | ✅ Production | Hide the spurious results search bar that the host flashes on every landing-page load (Ex Libris defect) |
| **Custom Loading Animation** | Asset (Lottie) | ✅ Production | Blue four-dot page-load animation replacing the default purple |
| **Quick Links Open in New Tab** | JS | ⚠️ Workaround | Landing-page quick-link "cubes" pointing off-site open in a new tab. Stands in for the `openInNewTab` flag Alma's Back Office does not expose — **[remove when Ex Libris fixes it](#landing-quick-links--new-tab-customjs)** |

**Key Technologies:**
- Angular 18 standalone components
- Shadow DOM manipulation
- Custom Alma labels (i18n)
- RTL/LTR bidirectional support
- Custom CSS styling

---

## 🧩 Add-ons & Components

These are the substantial custom-code features — Angular components loaded into NDE (and, for
the shelf map, a companion data pipeline). They carry the bulk of the engineering, testing, and
maintenance effort in this package. Lightweight CSS/asset tweaks are grouped separately under
[CSS & Styling Tweaks](#-css--styling-tweaks) below.

### 1. External Search Integration
Two complementary components that provide external search options throughout the search experience:

#### a) External Search Sources Panel (FilterAssistPanel)
Displays external search links in the filter side navigation, allowing users to search their current query in external sources.

**Implemented Features:**
- ✅ **External Search Links**: ULI, WorldCat, Google Scholar
- ✅ **Automatic Query Transfer**: Current search automatically transferred to external sites
- ✅ **Bilingual Support**: English and Hebrew with RTL layout
- ✅ **Smart Query Parsing**: Extracts search terms from Primo query format
- ✅ **Conditional Display**: Only shows when an active search exists

**Location in NDE:** Top of the filter side navigation (appears when clicking "All Filters")

**Technical Details:**
- Component: `FilterAssistPanelComponent`
- Selector mapping: `nde-filters-group-before`
- Files: `src/app/custom1-module/filter-assist-panel/`

#### b) No Results External Links
Displays an external-search panel on the no-results page (when a search returns zero records), helping users continue their research in alternative sources.

**Implemented Features:**
- ✅ **Alternative Search Options**: Same external sources (ULI, WorldCat, Google Scholar)
- ✅ **Bilingual Support**: English and Hebrew with RTL layout
- ✅ **Accessibility**: Keyboard navigation, ARIA labels, secure link attributes
- ✅ **Query Preservation**: Search term automatically included in external links
- ✅ **Width-matched to the adjacent ExLibris box**: a small `ResizeObserver` mirrors the width of the sibling `.we-suggest-container` so the two stacked boxes line up in any language / viewport. Falls back to `width: fit-content` if the ExLibris box is absent.

**Mounting strategy: extension slot (additive — does NOT override ExLibris's default).**

The component is registered against the `nde-search-no-results-bottom` selector. It is rendered as the **last child of ExLibris's `<nde-search-no-results>`**, alongside the default content (icon, heading, message, the `<nde-expand-options>` toggle introduced in Primo VE 2026, and the suggestions list). TAU's external-search section is appended below.

**Implication:** any new feature ExLibris adds to the default no-results layout renders automatically — we don't have to track upstream UI changes by hand.

**Location in NDE:** Below ExLibris's default no-results suggestions box.

**Technical Details:**
- Component: `NoResultsExternalLinksComponent`
- Selector mapping: `nde-search-no-results-bottom` (extension slot, mounts as last child)
- Files: `src/app/custom1-module/no-results-external-links/`

> **History:** this component started as a full replacement of `nde-search-no-results`. After Primo VE 2026 added the Expand Results Options toggle inside that slot — which the full replacement was hiding — we migrated to the `-bottom` extension slot. See [issue #4](https://github.com/hagaybar/TAU_customModule/issues/4) for the diagnosis and fix.

#### Shared Configuration
Both components use the same configuration file for consistency:
```
src/app/custom1-module/filter-assist-panel/config/external-sources.config.ts
```

Each source includes:
- Name (English and Hebrew)
- URL template
- Icon (16×16 PNG)
- Query mapping function to transform Primo queries

**Benefits:**
- **Single source of truth**: Changes to external sources apply to both components
- **Easy maintenance**: Add/remove sources in one place
- **Consistent UX**: Same sources and behavior across different contexts

**Migration Note:** This feature was migrated from AngularJS to Angular 18. See [Migration Summary](docs/features/external-search/MIGRATION_SUMMARY.md) for technical details.

---

### 2. CenLib Shelf Map
**Status:** ✅ Production (integrated via [PR #16](https://github.com/hagaybar/TAU_customModule/pull/16); bootstrap fix in [PR #17](https://github.com/hagaybar/TAU_customModule/pull/17); same-origin offline fallback in [PR #23](https://github.com/hagaybar/TAU_customModule/pull/23))

Adds an interactive **"Shelf Map"** button (Hebrew: **"מפת מדף"**) to holding locations in the full-record display. Where TAU has shelf data for a *library + collection + call number*, the custom module hides the native ExLibris **"Locate"** button and shows "Shelf Map" instead; clicking it opens a dialog that shows the section, floor, shelf label, and a **highlighted floor-plan SVG** pinpointing where the item sits on the shelf.

**Implemented Features:**
- ✅ **Location-level button**: replaces the native "Locate" button only where shelf data exists; falls back to "Locate" everywhere else
- ✅ **Floor-plan dialog**: highlights the matching shelf element(s) on the library's floor SVG
- ✅ **Multi-Dimensional Mapping (MDM)**: keyed on library + collection + Dewey call-number range; supports overlapping ranges (lists all candidate shelves)
- ✅ **Data-driven from a companion repo via AWS CloudFront CDN**: the shelf-mapping CSV and floor-plan SVGs are authored in the **Primo Maps** companion repo and published to a CloudFront CDN; the module fetches them at runtime, cached 5 min
- ✅ **Same-origin offline fallback** ([PR #23](https://github.com/hagaybar/TAU_customModule/pull/23)): a bundled snapshot of the mapping data + floor SVGs ships inside the custom package (`src/assets/cenlib-map/`). If the CDN is unreachable (outage or a CORS regression), the loaders fall back to these same-origin copies so the button and map keep working instead of silently disappearing — only if *both* the CDN **and** the bundle fail is the button hidden. Refresh the snapshot with `npm run sync:map-assets` before a deploy. Bundled as `mapping.txt` (not `.csv` — Alma's custom-package upload rejects `.csv` files)
- ✅ **Producer-matched call-number matching**: canonical Dewey comparison kept identical to the Primo Maps producer (`NDE_MAPS_MANGER`, issue #100) — cutter stripping, 3-digit zero-padding, `ML`/`MT` natural-number exception
- ✅ **Floor-scoping guard** (issue #12): a range must not span floors; off-floor matches are dropped and logged instead of highlighted on the wrong SVG
- ✅ **Bilingual Support**: English and Hebrew, detected from the `lang` URL parameter

**Companion repository (Primo Maps):** the map data this feature *consumes* is *produced* and
maintained in a separate repository, **`NDE_MAPS_MANGER`** (the "Primo Maps" manager). That repo
owns the librarian-facing admin tooling and validation Lambda that author the shelf-mapping CSV
and floor-plan SVG bundle, validate it (e.g. every `svgCode` must exist as an SVG element id —
`validateBundle.mjs`), and publish it to the AWS CloudFront CDN. This custom module is the
read-only **consumer**: it downloads the published bundle at runtime and renders it. The two
repos are deliberately kept in lock-step on the call-number rules — see the split of
responsibilities and the shared contract in [CenLib Shelf Map](docs/features/map_cenlib_shelves/README.md#companion-repository-primo-maps-nde_maps_manger).

**Currently configured for:** Sourasky Central Library (`הספרייה המרכזית סוראסקי`) reading rooms and special collections. The architecture is multi-library and extensible.

**Location in NDE:** At each physical location in the full-record display (`nde-location-top`), next to the "Locate" button area.

**Technical Details:**
- Components: `CenlibMapButtonComponent`, `CenlibMapDialogComponent`, `ShelfMapSvgComponent`
- Service: `ShelfMappingService` (CSV load/cache + Dewey range matching)
- Selector mapping: `nde-location-top`
- Files: `src/app/custom1-module/cenlib-map/`
- Requires `HttpClientModule` in the app bootstrap (see PR #17)
- Offline fallback: `services/map-asset-fallback.ts` (`cdnAssetToLocalPath` + `fetchTextWithFallback`) + bundled `src/assets/cenlib-map/` (`mapping.txt`, `floor_0/1/2.svg`); refresh with `npm run sync:map-assets`

**Documentation:** See [CenLib Shelf Map](docs/features/map_cenlib_shelves/README.md) for the full feature guide (data model, CDN layout, matching rules, the companion Primo Maps repo, and how to extend it to another library).

---

### 3. Announcement Banner
**Status:** ✅ Production (issue [#30](https://github.com/hagaybar/TAU_customModule/issues/30))
**Date Implemented:** 02.08.26 · **Production wording approved:** 03.08.26

A full-width, dismissible announcement strip mounted **above** the NDE header, in the style of the
Eastern Florida State College view. It currently carries the "refreshed look" launch message,
reassuring patrons that this is the familiar DaTA / דעת״א service in a new interface rather than a
different system.

**Current text (hard-coded — see the caveat below):**

| Language | Text |
|----------|------|
| English | Welcome to DaTA’s refreshed look, with the same familiar search experience from Tel Aviv University Libraries |
| Hebrew | ברוכים הבאים לדעת״א במראה רענן, עם אותה חוויית חיפוש מוכרת של ספריות אוניברסיטת תל אביב |

> The copy uses a real gershayim (`״`, U+05F4) in **דעת״א** and a curly apostrophe (`’`, U+2019) in
> **DaTA’s**, not their ASCII lookalikes. A unit test asserts both strings byte-for-byte, so re-typing
> either with a straight quote fails the build rather than silently shipping a typographic regression.

**Implemented Features:**
- ✅ **Bilingual, RTL-aware**: English/Hebrew text and `dir` chosen from `<html lang>`, falling back to the `lang` URL parameter and then `dir="rtl"` — the same priority the bilingual CSS rules use
- ✅ **Follows in-app language switches**: the banner mounts *outside* the router outlet, so it is never destroyed while browsing and `ngOnInit` runs only at first paint. A `MutationObserver` on `<html lang>`/`<html dir>` keeps the text in step. (The host router navigates with `pushState`, so `popstate` never fires — the attribute mutation is the only reliable signal without reaching into the host's NgRx store)
- ✅ **Dismissible, and it stays dismissed**: the ✕ button records `tauAnnouncementDismissed:v2` in `localStorage`. Bumping that version suffix retires previous dismissals, so a new announcement resurfaces for everyone
- ✅ **Accessible**: `role="status"` so screen readers announce it, a named dismiss button, and a visible keyboard focus ring (the host theme resets outlines in places). Body text is `#1f2933` on `#fdf3d0` — 13.8:1, well clear of WCAG AA
- ✅ **Logical CSS properties throughout** (`padding-inline`, `inset-inline-end`, `border-block-end`), so the strip and its dismiss button flip correctly in Hebrew without a second rule set

**Location in NDE:** the `nde-header-before` extension slot — above everything, including the top bar.
All four header slots were mounted live through the dev proxy to confirm the stacking order:

| Slot | Position | Placement |
|------|----------|-----------|
| **`nde-header-before`** | y=0 | sibling of `<nde-header>` — **chosen**, the only one above everything |
| `nde-header-top` | y=44 | inside `<nde-header>` |
| `nde-header-bottom` | y=89 | inside `<nde-header>` |
| `nde-header-after` | y=133 | sibling of `<nde-header>`, still above the nav bar |

> NDE registers these as `<slot>-from-remote-<n>`, not the bare slot name, so
> `customElements.get('nde-header-before')` is `false` at runtime **by design** — not a mounting failure.

**⚠️ The text is hard-coded.** Every wording change costs a rebuild **and** a manual Back Office
package upload. That is acceptable for a standing launch message; it is **not** acceptable if library
staff need to edit announcements themselves. Whether the banner must be dynamic is still an open
question, and it was open in the original request: the library's NDE feature-request document raised
the banner as "סוגייה 3" and explicitly deferred it — *"לברר האם זה טקסט דינאמי שמשתנה, או ש-hard
coded"* (establish whether the text is dynamic or hard-coded). That document is held by the library
and is deliberately **not** in this repo, which is public — ask the library for it rather than looking
for a path here. Its other items became issues #28, #29 and #31. If the answer is "dynamic", only the
source of `message` has to move — to Back Office labels or a same-origin JSON fetch. The slot,
styling, RTL handling, dismissal, and a11y all stay as they are.

**Technical Details:**
- Component: `AnnouncementBannerComponent` (standalone, `OnPush`)
- Selector mapping: `nde-header-before`
- Files: `src/app/custom1-module/announcement-banner/`
- Colour knobs: `--tau-announcement-bg` / `--tau-announcement-fg` / `--tau-announcement-accent` in the component SCSS
- Tests: `announcement-banner.component.spec.ts` — language precedence, in-app switching, dismissal persistence, a11y attributes, and exact wording

---

## 🎨 CSS & Styling Tweaks

Lightweight overrides applied via `src/assets/css/custom.css` (plus one Lottie asset swap). These
are small, self-contained styling adjustments — not application code — and are grouped here to keep
them distinct from the add-ons above.

### CSS customizations (`custom.css`)
Custom styling fixes and enhancements applied via `src/assets/css/custom.css`.

#### Call Number Directionality Fix
**Date Implemented:** 13.11.25

Ensures call numbers display left-to-right (LTR) regardless of UI language or page directionality settings.

**Problem Solved:** Mixed content call numbers like "892.413 מאו" were displaying with incorrect directionality in Hebrew/RTL contexts.

**Implementation:**
- **Location 1**: `nde-locations-container [data-qa="location-call-number"]`
  - Uses semantic `data-qa` attribute for reliable targeting
  - Applies to main locations display

- **Location 2**: `nde-location-item .getit-items-brief-property:nth-child(3)`
  - Targets third column in brief properties table (call number column)
  - Brief properties structure: Availability | Loan Policy | Call Number

**CSS Properties:**
```css
direction: ltr;           /* Forces left-to-right text direction */
unicode-bidi: embed;      /* Isolates bidirectional context */
display: inline-block;    /* Ensures proper containment */
font-weight: bold;        /* Makes call numbers bold for better visibility */
```

#### Location Availability Text Color
Changes the color of location availability text to green for better visibility.

**Target:** `.view-it-title.mat-title-small.ng-star-inserted span`

#### Card Title Styling
Makes card titles bold for improved visual hierarchy.

**Target:** `mat-card-title.mat-mdc-card-title.margin-bottom-medium`

#### Main Page Image Overlay (reverted)
Previously disabled the background overlay on the main-page top image. **Reverted** — the default overlay shading was restored, and the rule is left commented out in `custom.css` as a record.

**Target (inactive):** `.custom-search-bar-container .background-overlay`

#### Advanced Search Link Bold
**Date Implemented:** 14.06.26

Bolds the "Advanced search" link next to the search bar — English ("Advanced Search") and Hebrew ("חיפוש מתקדם"). Host default weight is 500 (medium).

**Target:** `.advanced-search-button` (language-independent button class; the nested `.mdc-button__label` inherits the weight).

```css
.advanced-search-button { font-weight: bold !important; }
```

#### Landing "About" Stray Checkmark Bullets
**Date Implemented:** 18.06.26

Removes the stray empty checkmark bullets that appeared at the bottom of the landing "About" box ("מה מחפשים בדעת״א?") on the native NDE landing page (issue #15).

**Problem Solved:** The native `<nde-landing-about>` component renders one `<li>` — each with a hardcoded `success.svg` checkmark — per label `nde.landing.about.bullet1`–`bullet4`. TAU wants no benefits list, but **the labels cannot express that**: a truly empty value errors on save, deleting the override restores the Ex Libris default text, and `&nbsp;` blanks the text yet leaves the checkmark. So hiding the list in CSS is the only way to remove the bullets.

**Target:** `nde-landing-about .help-sign-in-container ul`

```css
nde-landing-about .help-sign-in-container ul { display: none !important; }
```

Only affects views using the native landing page (`loadLandingPage: true`) — production `NDE`, and `NDE_TEST` since it was rebuilt as a duplicate of `NDE`. Validated live on `NDE_TEST`.

#### Hide Update Login Credentials
**Date Implemented:** 21.12.25

Hides the "Update Login Credentials" card actions section in the MyAccount area for a cleaner user interface.

**Target:** `.mat-mdc-card-actions`

**CSS Properties:**
```css
display: none !important;  /* Completely hides the card actions element */
```

#### Bilingual Logo
**Date Implemented:** 27.05.26

Shows a language-specific library logo in the NDE top bar — the English logo in LTR/English UI, the Hebrew logo in Hebrew UI. NDE has no native per-language logo (`libraryLogo` is a single value), so the swap is done in CSS.

**Mechanism:** the logo is a host `<img>` inside `<nde-logo>`. CSS can't rewrite an `<img>` `src`, so the `content:` property repaints it (preserving `alt`). English uses the default `library-logo.png` (no rule needed); only Hebrew is overridden.

```css
html[lang="he"] nde-logo img,
html:not([lang])[dir="rtl"] nde-logo img {
  content: url('../images/library-logo-he.png');
}
```

**Priority:** `lang` decides when present; `dir` is a fallback only when `lang` is absent — so a future Arabic UI (`lang="ar"`, also RTL) correctly keeps the default logo rather than the Hebrew one.

**Files:** `src/assets/images/library-logo.png` (English), `library-logo-he.png` (Hebrew). Previous logo variants archived under `src/assets/images/archive/`.

#### Bilingual Search Background
**Date Implemented:** 27.05.26

Shows a language-specific homepage search banner — separate images for English and Hebrew UI (the magnifier graphic is mirrored for RTL). NDE has no per-language background image, so this is a CSS override on the host banner element.

**Target:** `.top-bar-background-image` (host element, `background-size: cover`, full screen width).

```css
.top-bar-background-image {
  background-image: url('../images/homePageImages/search_background_en.png') !important;
}
html[lang="he"] .top-bar-background-image,
html:not([lang])[dir="rtl"] .top-bar-background-image {
  background-image: url('../images/homePageImages/search_background_he.png') !important;
}
```

The relative `../images/...` path resolves to the custom package automatically (no hardcoded view-id), and the `lang`→`dir` priority matches the logo.

**Files:** `src/assets/images/homePageImages/search_background_en.png` (English), `search_background_he.png` (Hebrew).

**Documentation:** See [Call Number Directionality Fix](docs/reference/call_number_directionality_fix.md) for detailed technical information including selectors, strategies, and Primo VE implementation.

#### Landing Page Banner Override (native `<img>` overlay)
**Date Implemented:** 07.07.26

On **2026-07-07 Ex Libris changed the NDE native landing page** (`/nde/home`, served when `loadLandingPage` is enabled) **without notifying us**. It now renders its **own** `<img class="landing-search-background-img">` **layered on top** of the `.landing-search-background-image` element that the [Bilingual Search Background](#bilingual-search-background) rule targets. That `<img>`'s `src` points at a **Primo Back-Office landing-page asset** (`assets/landingpage/search_background.jpg`) — a *single* image for both languages, **not part of this package**, and editable out-of-band from the Back Office landing-page editor. The visible effect: the homepage banner silently reverted to a previous image, and our per-language override was hidden underneath and could no longer win.

CSS cannot rewrite an `<img>`'s `src`, but `content: url()` repaints what it renders — the same technique as the [Bilingual Logo](#bilingual-logo). We repaint the native `<img>` per-language, preserving the host's full-width `object-fit: cover` sizing:

```css
.landing-search-background-img {
  content: url('../images/homePageImages/search_background_en.png');
}
html[lang="he"] .landing-search-background-img,
html:not([lang])[dir="rtl"] .landing-search-background-img {
  content: url('../images/homePageImages/search_background_he.png');
}
```

This restores per-language control of the homepage banner from the custom package. Because `content` replaces the rendered pixels **regardless of the element's `src`**, it also holds if the Back-Office `search_background.jpg` is ever swapped again. It reuses the same image files as the Bilingual Search Background rule.

> **Two rules, two elements/pages:** `.top-bar-background-image` (Bilingual Search Background) styles the **search-results** top bar via `background-image`; `.landing-search-background-img` (this rule) handles the **native landing page** overlay `<img>` via `content`. Both are needed.

**Files:** `src/assets/images/homePageImages/search_background_en.png`, `search_background_he.png` (shared with Bilingual Search Background).

**Documentation:** See [Landing Banner Customization](docs/features/landing-banner-customization.md) for the full banner/CSS playbook.

#### Landing Search-Bar Flash Suppression
**Date Implemented:** 02.08.26

Hides the **results-page** search bar that the NDE host briefly renders on every landing-page load.

**Problem Solved:** on every `/nde/home` load — including a plain refresh — the results search bar
appears for roughly 200–500 ms and then vanishes as the landing page takes over. Patrons see a search
box pop in and disappear, plus the layout jump that goes with it.

**This is an Ex Libris host defect, not ours.** The app boots into the results-page structure and only
then tears it down and builds the landing page. Measured live on `NDE_TEST`: at ~430–630 ms
`<nde-top-bar>` exists as a **direct child** of `div.search-container` *without* `.top-bar-not-sticky`
(i.e. results mode); it later gains that class and **moves** into
`div.custom-search-bar-container`. Reproduced on production `972TAU_INST:NDE`, which carries none of
this repository's code, and on an unrelated tenant (`01FALSC_EFSC:NDE_EFSC`) — so it is product-level.
The rule below is a **cosmetic suppression**; the real fix belongs to Ex Libris.

**Why this selector:** during the flash the DOM is byte-for-byte the results layout, so neither the top
bar's own classes nor its ancestors can distinguish the two routes. JS is no help either —
`assets/js/custom.js` loads at ~1184 ms, after the flash has ended, so only `custom.css` is in play.
Diffing the live DOM at flash time surfaced `<nde-landing-page-config>` in a *sibling* subtree of the
same `.search-container`, present for 100% of the flash window on landing loads and never on results
loads. It comes **after** the bar in document order, so `:has()` is required — CSS has no
preceding-sibling combinator.

```css
.search-container:has(nde-landing-page-config) > nde-top-bar:not(.top-bar-not-sticky) {
  display: none !important;
}
```

**Safety:** `:not(.top-bar-not-sticky)` leaves the settled landing bar alone, and the `:has()` clause
cannot match on the results page — the rule can never hide the real results search bar. On a browser
without `:has()` support the whole rule is dropped and the behaviour is simply today's flash.
`display: none` (not `visibility: hidden`) so no space is reserved and there is no layout jump.

**Documentation:** See [Landing-page search-bar flash](docs/troubleshooting/landing-page-search-bar-flash.md)
for the full investigation, and [Ex Libris case draft](docs/troubleshooting/exlibris-case-search-bar-flash.md)
for the evidence-only write-up to file with support.

#### Resource-Type Pill Chip
**Date Implemented:** 02.08.26 · **Issue:** [#31](https://github.com/hagaybar/TAU_customModule/issues/31)

Renders the resource type on results cards ("Journal", "Article", "Book", "ספר", "כתב עת") as a filled
pill chip instead of plain text, matching the requested design and the `44HUD_INST:HUD` reference view.

**Host default:** `<span class="record-type text-uppercase">` inside `<nde-record-type>` — computed
`rgb(67,71,78)` on transparent, 12px/500, `display: inline`.

**Target:** `nde-record-type span.record-type`

```css
nde-record-type span.record-type {
  display: inline-block !important;
  padding-block: 0.15rem !important;
  padding-inline: 0.55rem !important;
  border-radius: 999px !important;
  line-height: 1.4 !important;
  background-color: var(--sys-primary) !important;
  color: var(--sys-on-primary) !important;
}
```

**Scope — the resource *type* only.** The sibling indications ("Peer Reviewed", "Open Access",
`span.record-indication`) are deliberately left as plain text: the approved screenshot shows "Journal"
as a pill with "Peer" beside it unstyled.

**Colours come from the view's theme tokens**, not hardcoded hex, so the chip follows automatically if
the primary is ever changed. Contrast at the 12px label size (AA needs 4.5:1):
`--sys-on-primary` `#ffffff` on `--sys-primary` `#3f608a` = **6.46:1 PASS**. If `--sys-primary` is ever
lightened past roughly `#4a70a0` this drops below 4.5:1 — re-check then.

Padding uses logical properties per the repo BiDi convention, so the chip stays symmetric in Hebrew RTL
(`text-uppercase` is a no-op in Hebrew, which is expected).

#### Search-Bar Band
**Date Implemented:** 02.08.26 · **Scope corrected:** 04.08.26 ·
**Issues:** [#28](https://github.com/hagaybar/TAU_customModule/issues/28),
[#36](https://github.com/hagaybar/TAU_customModule/issues/36)

Puts a solid colour band behind the search bar on the **results** and **full-record** pages, so the
near-white search box (`#faf9fd`) reads as a distinct element instead of white-on-white. Mirrors
`01FALSC_BRC:NDE_BRC` (verified live: their `nde-top-bar` is `rgb(0,85,150)` with white bar text, while
their box stays `rgb(251,248,255)` with `rgb(27,27,32)` text).

**The search box itself is not touched** — it keeps its host fill and its dark query text. Only the band
and the text items sitting on it change. The full-record page renders the Advanced Search link but no
search-scope label, so there the rule simply has one less item to recolour.

```css
.search-container:not(:has(nde-landing-page-config)) > nde-top-bar {
  --tau-search-band-bg: #487797;
  background-color: var(--tau-search-band-bg) !important;
}
/* …plus a white colour on .search-dropdown-container-button-text / -icon,
   .advanced-search-button and its .mdc-button__label */
```

**Accessibility — why this exact blue.** Two text items sit on the band and are set white: the
search-scope label ("TAU", 14px/400) and the Advanced Search link (14px/700). Neither qualifies as WCAG
"large text" (that needs 24px regular / 18.66px bold — **bolding alone does not lower the bar**), so the
full 4.5:1 threshold applies to both:

| Colour | White-on-band contrast | Verdict |
|--------|------------------------|---------|
| `#487797` (shipped) | 4.82:1 | **PASS** |
| `#4B7C9D` (originally requested) | 4.4977:1 | fails AA by 0.002 |

`#4B7C9D` was the originally requested shade; it lands just under the line, and TAU publishes an
accessibility statement linked from our own footer, so an automated audit comparing the exact value
would flag this element. How different are they? **CIEDE2000 ΔE = 1.93** (`#487797` is 1.9 L\* darker) —
perceptible only on close side-by-side inspection, not identical. Nobody comparing against a memory or a
screenshot will spot it, but held against each other on a large flat band a sharp eye can. If the exact
requested shade ever matters more than the 0.002 AA margin, that is the knob. The dropdown chevrons are
non-text (3:1 required) and pass comfortably either way.

**The colour appears exactly once**, in `--tau-search-band-bg` — change it there and nowhere else.

**Scoping — two guards, and only two:**

| Guard | Why |
|-------|-----|
| `.search-container > …` | the **landing** `nde-top-bar` lives under `.custom-search-bar-container`, not as a direct child here |
| `:not(:has(nde-landing-page-config))` | during landing-page **boot** the host briefly renders the results layout — same container, same classes — so without this guard the band would flash blue across the landing page on every load. An earlier attempt at this rule had exactly that fault |

The second guard is the same host-boot behaviour documented under
[Landing Search-Bar Flash Suppression](#landing-search-bar-flash-suppression) above; the two rules are
two sides of one host quirk and must be kept in step.

> **Do not add `:not(.top-bar-not-sticky)` to this rule** — that was [#36](https://github.com/hagaybar/TAU_customModule/issues/36).
> It shipped with #28 on the reading that the class marks the landing bar. It does not: it means *this
> bar does not stick*, and the host applies it on the **full-record** route as well, so the band silently
> disappeared on `/nde/fulldisplay` while looking correct on `/nde/search`. Measured live on
> `972TAU_INST:NDE`:
>
> | Route | `nde-top-bar` parent | `.top-bar-not-sticky` | Effect of the old guard |
> |-------|----------------------|-----------------------|-------------------------|
> | `/nde/search` | `div.search-container` (direct child) | no | band shown |
> | `/nde/fulldisplay` | `div.search-container` (direct child) | **yes** | **band wrongly suppressed** |
> | `/nde/home` | nested under `.custom-search-bar-container` | yes | already excluded by guard 1 |
>
> It was redundant as well as wrong: the settled landing bar is excluded by the direct-child combinator,
> and during the landing boot window the spurious bar carries no `.top-bar-not-sticky` at all — so it
> never guarded the flash either. The same class **is** load-bearing in the flash-suppression rule above,
> where it is what distinguishes the spurious boot bar from the settled landing bar. The two rules are
> not interchangeable.

### Custom Loading Animation
**Date Implemented:** 17.06.26

Replaces the Primo NDE page-load animation (the default "four purple dots") with a **blue** four-dot animation that fits a blue NDE theme.

**How it works:** the NDE host fetches a Lottie animation at boot from the custom package and uses it instead of its built-in default. The file must be named exactly `LoadingAnimationJson.json` and live under `assets/images/loadingAnimations/` in the package (in this repo: `src/assets/images/loadingAnimations/`, which the build maps to `<package>/assets/...` — no `angular.json` change needed).

**File:** `src/assets/images/loadingAnimations/LoadingAnimationJson.json` — the Ex Libris default Lottie, hue-rotated from violet to azure (`#003b7e → #0052b3 → #538bcc → #b0c9e7`), keeping the original motion. Colors are baked into the JSON; the boot animation does **not** follow the `--sys-primary` theme token.

**Documentation:** See [Loading Animation Color (Ex Libris Case 10665359)](docs/troubleshooting/loading-animation-color-not-themed.md) for the full investigation — why the view theme can't recolor the default dots and how the replacement works.

### Landing Quick Links → New Tab (`custom.js`)
**Date Implemented:** 03.09.26 · **⚠️ Workaround — has a removal condition, see below**

The landing-page quick links ("the cubes") that point **off-site** open in a new tab, so the landing
page isn't lost. In-app Primo routes (the library-card link) deliberately stay in the same tab.

**Why it isn't a Back Office setting.** The native landing page renders its quick links from the
per-view Back Office file `assets/landingpage/landingpage.json`. Each link there carries an
`openInNewTab` flag and the host component `nde-landing-quick-links` honours it
(`target="_blank" rel="noopener noreferrer"` + the "(Opens in a new tab)" aria suffix) — but Alma's
Landing Page tab only exposes **Label / URL / Icon**, so a library can't set the flag. We can't ship
a corrected file either: `assets/landingpage/` is injected per view by Ex Libris and is **not** part
of this package.

**How it works:** `src/assets/js/custom.js` is a plain script the host loads from the package. It
lets the host render the page normally, then sets `target` / `rel` / aria on the external quick-link
anchors — exactly what the renderer would have done if the flag were set. It re-applies after an
in-app language switch.

**File:** `src/assets/js/custom.js` (previously an empty placeholder — this is the only logic in it).

> **🗑️ Remove this when it's no longer needed.** This is a workaround for a Back Office gap, not a
> TAU design decision. Delete the logic in `custom.js` (restoring it to an empty placeholder) once
> **either** Ex Libris exposes `openInNewTab` in the Landing Page tab and the flag is set on the
> view, **or** Ex Libris support sets `openInNewTab: true` directly on the view's
> `landingpage.json`. To check whether that has happened, look at
> `/nde/custom/972TAU_INST-NDE/assets/landingpage/landingpage.json` — if the links already say
> `"openInNewTab": true`, this script is redundant and should go.

**Documentation:** See [Landing Quick Links: Open in New Tab](docs/features/landing-quick-links-new-tab.md)
for the evidence, why the four reference views (British Library, 3M, Angelo State, RMIT) don't apply
to us, and the verification runs.

---

## 🔎 Debug Logging Activation

The module loads into Primo in **every patron's browser**, so diagnostic logging is gated behind
`dlog()` / `dwarn()` and is silent in production. Full rules and rationale:
**[Debug Logging](docs/development/debug-logging.md)**.

### The boot banner

Every page load prints exactly one line, in every view, whether or not logging is on:

```
[TAU] custom module · 972TAU_INST-NDE · debug logging OFF (view default)
      enable: localStorage.setItem('tauDebug','1') then reload — or add ?tauDebug=1 to the URL
```

Read it first when something looks wrong. It separates three states an empty console cannot:

| What you see | What it means |
|---|---|
| No `[TAU]` line at all | The module never loaded. The problem is deployment, not your component. |
| `debug logging OFF` | The module is fine — you just have not turned logging on. |
| `debug logging ON`, still nothing | Module fine, logging on. The silence is real. |

Because the line names the **package** it was built for, a mis-deployed upload (an `NDE_TEST`
package sitting on `NDE`) is visible on the first page load rather than after an afternoon of
confusion. This is the only ungated `console.log` in the codebase — a static string plus one
build-time constant, no runtime values and no patron data.

### Turning logging on

`NDE_TEST` logs **by default**; `NDE` and any future view are silent unless asked. Three switches,
each beating the one above it:

| Switch | Scope | Use it when |
|---|---|---|
| `?tauDebug=1` in the URL | Persists (writes to `localStorage`) | You need someone else's console. Send the link — no devtools instructions. `?tauDebug=0` turns it off the same way. |
| `localStorage.setItem('tauDebug','1')` | Persists across reloads | You are debugging yourself. Catches early bootstrap logs. |
| `window.__TAU_DEBUG__ = true` | This session only | A one-off look without leaving the flag behind. |

`setItem('tauDebug','0')` is a real **off** — it silences even `NDE_TEST`. `removeItem('tauDebug')`
is different: it stops overriding and falls back to the view default.

The flag is a **runtime** switch, never a build flag. That is what lets you turn logging on against
live production with no rebuild and no package upload — worth preserving in any change here.
Design rationale: **[spec](docs/superpowers/specs/2026-08-09-debug-logging-activation-design.md)**.

---

## 📚 Documentation

Comprehensive documentation is organized in the [`docs/`](docs/) folder:

### Feature Documentation

#### External Search Integration
- **[External Search Implementation](docs/features/external-search/EXTERNAL_SEARCH_IMPLEMENTATION.md)** - Complete technical guide
- **[Migration Summary](docs/features/external-search/MIGRATION_SUMMARY.md)** - AngularJS to Angular 18 migration
- **[Icon Setup Notes](docs/features/external-search/ICON_SETUP_NOTES.md)** - Icon installation guide

#### CenLib Shelf Map
- **[CenLib Shelf Map](docs/features/map_cenlib_shelves/README.md)** - Interactive shelf-location map (data model, CDN layout, call-number matching, extension guide)

### Reference Documentation
- **[Call Number Directionality Fix](docs/reference/call_number_directionality_fix.md)** - CSS fixes for call number display (VE & NDE)

### Troubleshooting
- **[Bug Fix History](docs/troubleshooting/BUGFIX_HISTORY.md)** - Bug fixes and resolutions
- **[Asset Path Fix](docs/troubleshooting/ASSET_PATH_FIX.md)** - Asset path resolution in NDE context
- **[Loading Animation Color (Ex Libris Case 10665359)](docs/troubleshooting/loading-animation-color-not-themed.md)** - Why the view theme can't recolor the default dots, and how to replace the animation
- **[Landing-page search-bar flash](docs/troubleshooting/landing-page-search-bar-flash.md)** - Host boots into the results layout before building the landing page; measurements, selector rationale, and the CSS suppression
- **[Ex Libris case draft: search-bar flash](docs/troubleshooting/exlibris-case-search-bar-flash.md)** - Evidence-only write-up to file with Ex Libris support

### Reference & Styling
- **[Landing Banner & Search-Bar Customization](docs/features/landing-banner-customization.md)** - Banner font/color/overlay/search-bar playbook + full `custom.css` rule inventory
- **[Landing Quick Links: Open in New Tab](docs/features/landing-quick-links-new-tab.md)** - Why the Back Office cannot set `openInNewTab`, and the `custom.js` workaround
- **[NDE Theme Customization](docs/development/NDE_THEME_CUSTOMIZATION.md)** - Branding NDE colors/typography via Material SCSS

### Research & Development
- **[NDE Integration Research](docs/research/NDE_INTEGRATION_RESEARCH.md)** - NDE integration research
- **[Development Guidelines](docs/development/AGENTS.md)** - Repository development guidelines
- **[Debug Logging](docs/development/debug-logging.md)** - Gated `dlog()`/`dwarn()` logging: the always-on boot banner, the `NDE_TEST` default, and the three activation switches (issue #10)
- **[Debug-Logging Activation Design](docs/superpowers/specs/2026-08-09-debug-logging-activation-design.md)** - Why the default is bound to the view but the manual override is never lost (issue #40)

### Technical Specifications
- **[SPECS.md](SPECS.md)** - Detailed technical specifications

**See the [Documentation Index](docs/README.md) for the complete documentation map.**

---

## 🚀 Quick Start (TAU Setup)

### 1. Install Dependencies
> **Node.js version:** this project requires **Node.js v18.20.8**. Run `nvm use 18.20.8` before any `npm`/`node`/build command to ensure consistent builds.
```bash
npm install
```

### 2. Configure Build Settings
Edit `build-settings.env`:
```bash
INST_ID=972TAU_INST
VIEW_ID=NDE_TEST  # or NDE for production
ASSET_BASE_URL=/nde/custom/972TAU_INST-NDE_TEST
```

### 3. Development Server
```bash
npm run start
```
Access at: `http://localhost:4201`

Or with proxy:
```bash
npm run start:proxy
```

### 4. Build for Production
```bash
npm run build
```
Output: `dist/972TAU_INST-NDE_TEST.zip`

### 5. Deploy to Alma
1. Upload ZIP to Alma Back Office
2. Navigate to: **Discovery > View List > Edit**
3. Go to: **Manage Customization Package** tab
4. Upload and save

---

## Prerequisites

### Node.js and npm (Node Package Manager)
1. **Verify Node.js and npm Installation:**
    - Open a terminal.
    - Run the following commands to check if Node.js and npm are installed:
        ```bash
        node -v
        npm -v
        ```
    - If installed, you will see version numbers. If not, you will see an error.

2. **Install Node.js and npm (if not installed):**
    - Visit the [Node.js download page](https://nodejs.org/en/download/).
    - Download the appropriate version for your operating system (npm is included with Node.js).
    - Follow the installation instructions.

### Angular CLI

1. **Verify Angular CLI Installation:**
    - Open a terminal.
    - Run the following command:
        ```bash
        ng version
        ```
    - If Angular CLI is installed, you will see the version and installed Angular packages.

2. **Install Angular CLI (if not installed):**
    - After installing Node.js and npm, install Angular CLI globally by running:
        ```bash
        npm install -g @angular/cli
        ```

---

## Development server setup and startup

### Step 1: Download the Project
1. Navigate to the GitHub repository: [https://github.com/ExLibrisGroup/customModule](https://github.com/ExLibrisGroup/customModule).
2. Download the ZIP file of the project.
3. Extract the ZIP file to your desired development folder (e.g., `c:\env\custom-module\`).

### Step 2: Install Dependencies
1. Inside the `customModule` directory, install the necessary npm packages:
    ```bash
    npm install
    ```

### Step 3: Configuring proxy for and starting local development server

There are two options for setting up your local development environment: configuring a proxy or using parameter on your NDE URL.

- **Option 1: Update `proxy.conf.mjs` Configuration**:
  - Set the URL of the server you want to test your code with by modifying the `proxy.conf.mjs` file in the `./proxy` directory:
    ```javascript
    // Configuration for the development proxy
    const environments = {
      'example': 'https://myPrimoVE.com',
    }

    export const PROXY_TARGET = environments['example'];
    ```
  - Start the development server with the configured proxy by running:
    ```bash
    npm run start:proxy
    ```
  - Open your browser on port 4201 to see your changes.
    
    **URL Templates:**
    - **Production View:** `http://localhost:4201/nde/home?vid=972TAU_INST:NDE&lang=en`
    - **Test View:** `http://localhost:4201/nde/home?vid=972TAU_INST:NDE_TEST&lang=en`
    - **Generic Template:** `http://localhost:4201/nde/home?vid=YOUR_VIEW_CODE&lang=en`

  
- **Option 2: Parameter on NDE URL**:
    - Start your development server by running
      ```bash
      npm run start
      ```
    -  Add the following query parameter to your NDE URL:
      ```
      useLocalCustomPackage=true
      ```
      For example: `https://sqa-na02.alma.exlibrisgroup.com/nde/home?vid=EXLDEV1_INST:NDE&useLocalCustomPackage=true`
    - This setting assumes that your local development environment is running on the default port `4201`.
 
### Troubleshooting

#### Missing Background Image in Local Proxy
If you do not see the top background image when running `npm run start:proxy`:
1. **Cause:** The proxy configuration (`proxy/customization_config_override.mjs`) attempts to load a local image (`src/assets/homepage/homepage_background.svg`) which may not exist.
2. **Fix:** 
   - **Option A (Use Default):** Comment out the `homepageBGImage` line in `proxy/customization_config_override.mjs` to use the default production image.
   - **Option B (Use Custom):** Add your custom image file to `src/assets/homepage/` and ensure the filename matches the configuration.
   - **Note:** You must restart the proxy server (`npm run start:proxy`) for configuration changes to take effect.

  
---

## Step 4: Code Scaffolding and Customization

### Add Custom Components
1. Create custom components by running:
    ```bash
    ng generate component <ComponentName>
    ```
    Example:
    ```bash
    ng generate component RecommendationsComponent
    ``` 

2. Update `selectorComponentMap` in `customComponentMappings.ts` to connect the newly created components:
    ```typescript
    export const selectorComponentMap = new Map<string, any>([
      ['nde-recommendations-before', RecommendationsComponentBefore],
      ['nde-recommendations-after', RecommendationsComponentAfter],
      ['nde-recommendations-top', RecommendationsComponentTop],
      ['nde-recommendations-bottom', RecommendationsComponentBottom], 	  
      ['nde-recommendations', RecommendationsComponent],
      // Add more pairs as needed
    ]);
    ```

3. Customize the component’s `.html`, `.ts`, and `.scss` files as needed:
    - `src/app/recommendations-component/recommendations-component.component.html`
    - `src/app/recommendations-component/recommendations-component.component.ts`
    - `src/app/recommendations-component/recommendations-component.component.scss`



- All components in the NDE are intended to be customizable. However, if you encounter a component that does not support customization, please open a support case with us. This helps ensure that we can address the issue and potentially add customization support for that component in future updates.

### Accessing host component instance

You can get the instance of the component your custom component is hooked to by adding this property to your component class:

```angular2html
@Input() private hostComponent!: any;
```

### Accessing app state

- You can gain access to the app state which is stored on an NGRX store by injecting the Store service to your component:

```angular2html
private store = inject(Store);
```

- Create selectors. For example: 

```angular2html
const selectUserFeature = createFeatureSelector<{isLoggedIn: boolean}>('user');
const selectIsLoggedIn = createSelector(selectUserFeature, state => state.isLoggedIn);
```

- Apply selector to the store to get state as Signal:

```angular2html
isLoggedIn = this.store.selectSignal(selectIsLoggedIn);
```

Or as Observable:

```angular2html
isLoggedIn$ = this.store.select(selectIsLoggedIn);
```

### Translating from code tables 

You can translate codes in your custom component by using ngx-translate (https://github.com/ngx-translate/core).

- If you are using a stand alone component you will need to add the TranslateModule to your component imports list.
- In your components HTML you can translate a label like so:
```angular2html
<span>This is some translated code: {{'delivery.code.ext_not_restricted' | translate}}</span>
```


---

## Creating your own color theme

The NDE theming is based on Angular Material. 
We allow via the view configuration to choose between a number of pre built themes.

![prebuilt theme image](./readme-files/prebuilt-themes.png "prebuilt themes configuration")


If you want to create your own theme instead of using one of our options follow these steps:

1. Create a material 3 theme by running:
    ```bash
    ng generate @angular/material:m3-theme
    ``` 
   You will be prompted to answer a number of questions like so:
  ```
? What HEX color should be used to generate the M3 theme? It will represent your primary color palette. (ex. #ffffff) #1eba18
? What HEX color should be used represent the secondary color palette? (Leave blank to use generated colors from Material)
? What HEX color should be used represent the tertiary color palette? (Leave blank to use generated colors from Material)
? What HEX color should be used represent the neutral color palette? (Leave blank to use generated colors from Material)
? What is the directory you want to place the generated theme file in? (Enter the relative path such as 'src/app/styles/' or leave blank to generate at your project root) src/app/styles/
? Do you want to use system-level variables in the theme? System-level variables make dynamic theming easier through CSS custom properties, but increase the bundle size. yes
? Choose light, dark, or both to generate the corresponding themes light

```
- Note that it is imporant to answer yes when asked if you want to use system-level variables.

- Also note that I'm only entering the primary color and not secondary or tertiary. They will be selected automatically based on my primary color.

Once this script completes successfully you will recieve this message: 

`CREATE src/app/styles/m3-theme.scss (2710 bytes)`

To apply the theme go to `_customized-theme.scss` and uncomment the following lines:
```
.custom-nde-theme{
  @include mat.all-component-colors(m3-theme.$light-theme);
  @include mat.system-level-colors(m3-theme.$light-theme);
}
```
---



## Developing an Add-On for the NDE UI

The NDE UI supports loading of custom modules at runtime and also provides infrastructure to dynamically load add-ons developed by vendors, consortia, or community members. This enables seamless integration, allowing institutions to configure and deploy external add-ons through **Add-On Configuration in Alma**.

The NDE UI add-on framework allows various stakeholders to develop and integrate custom functionality:

- **Vendors** can create and host services that institutions can seamlessly incorporate into their environment.
- **Institutions and consortia** can develop and share custom components, enabling consistency and collaboration across multiple libraries.

Library staff can easily add, configure, and manage these add-ons through Alma, following guidelines provided by the stakeholders. These typically include:

- **Add-on Name** – The identifier used in Alma’s configuration.
- **Add-on URL** – The location where the add-on is hosted (static folder to load the add-on at runtime).
- **Configuration Parameters** – JSON-based config parameters to be referenced at runtime by the add-on.

![Add-on Overview](./readme-files/addon-overview.png)

---

## Guidelines for Developing an Add-On

You can download the custom module and modify it to function as an add-on.

### Set Add-on Name

This section below should remain the same.

![Set Addon Name](./readme-files/set-addon-name.png)

![Example Configuration JSON](./readme-files/example-config-json.png)

---

The add-on infrastructure provides a way to access institution-specific configuration parameters. Institutions can upload their configuration settings in JSON format, which your add-on can reference dynamically within its components.

### 🔧 Accessing Add-On Configuration Parameters

Use Angular DI to inject the parameters directly into your component via the `MODULE_PARAMETERS` token:

```ts
import { Component, Inject } from '@angular/core';

@Component({
  selector: 'custom-test-bottom',
  host: { 'data-component-id': 'custom-test-bottom-unique' },
  templateUrl: './test-bottom.component.html',
  styleUrls: ['./test-bottom.component.scss']
})
export class TestBottomComponent {
  constructor(@Inject('MODULE_PARAMETERS') public moduleParameters: any) {
    console.log('Module parameters TestBottomComponent:', this.moduleParameters);
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }
}

```

> 📘 `yourParamKey` should match the keys defined in your Alma Add-on JSON configuration.

---

If your add-on includes assets such as images, you can ensure a complete separation between the frontend code and asset deployment. To achieve this, set `ASSET_BASE_URL` to point to your designated static folder, allowing your add-on to reference assets independently of the core application.

![Access Assets via ASSET_BASE_URL](./readme-files/access-assets.png)


The `autoAssetSrc` directive automatically prepends `ASSET_BASE_URL` to your `[src]` attribute.

### Example:
```html
<img autoAssetSrc [src]="'assets/images/logo.png'" />
```

With:
```env
ASSET_BASE_URL=http://il-urm08.corp.exlibrisgroup.com:4202/
```

Results in:
```html
<img src="http://il-urm08.corp.exlibrisgroup.com:4202/assets/images/logo.png" />
```

### Supported Elements:
- `<img>`
- `<source>`
- `<video>`
- `<audio>`

> ✅ Always use `[src]="'relative/path'"` to ensure proper asset URL injection.

---




---

## Recommended Development Environment

To ensure smooth development, debugging, and code management, we recommend setting up your environment with the following tools:

### 🖥️ IDEs and Editors

- **Visual Studio Code (VSCode)** – Highly recommended  
  [Download VSCode](https://code.visualstudio.com/)
  - Recommended Extensions:
    - `Angular Language Service`
    - `ESLint` or `TSLint`
    - `Prettier - Code formatter`
    - `Path Intellisense`
    - `Material Icon Theme` (optional for better visuals)

- **WebStorm**  
  A powerful alternative with built-in Angular and TypeScript support.  
  [Download WebStorm](https://www.jetbrains.com/webstorm/)

- **IntelliJ IDEA**  
  A full-featured IDE by JetBrains. Ideal if you’re also working with Java backend.  
  [Download IntelliJ IDEA](https://www.jetbrains.com/idea/)

- **Eclipse IDE**  
  Suitable for full-stack development including Angular with the right plugins.  
  [Download Eclipse](https://www.eclipse.org/downloads/)

---

### 🔧 Tools & Utilities

- **Node Version Manager (nvm)**  
  Manage multiple versions of Node.js easily:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```

- **Angular CLI**
  ```bash
  npm install -g @angular/cli
  ```

- **Git GUI Clients**
  - GitHub Desktop
  - Sourcetree
  - GitKraken

---

### 🔍 Debugging & Testing

- Use **Chrome Developer Tools** for runtime inspection.
- Install **Augury Extension** (Angular DevTools) for inspecting Angular components.
- **TAU debug logging** — see [Debug Logging Activation](#-debug-logging-activation) above for the
  boot banner and the three ways to switch diagnostic output on.

---

### 🧪 Optional Tools

- **Postman** – For testing API requests.
- **Docker** – For isolated build environments.
- **Nx** – Monorepo tool (if planning multiple apps/libraries).

---
## Build the Project

### Step 5: Build the Project
1. Compile the project:
    ```bash
    npm run build
    ```

2. After a successful build, the compiled code will be in the `dist/` directory.


- **Automatic Packaging**:
  - The build process automatically compiles and packages the project into a ZIP file named according to the `INST_ID` and `VIEW_ID` specified in the `build-settings.env` file located at:
    ```
    C:\env\nde\customModule-base\build-settings.env
    ```
  - Example configuration:
    ```
    INST_ID=DEMO_INST
    VIEW_ID=Auto1
    ```
  - The ZIP file, e.g., `DEMO_INST-Auto1.zip`, is automatically created in the `dist/` directory after a successful build.


### Step 6: Upload Customization Package to Alma
1. In Alma, navigate to **Discovery > View List > Edit**.
2. Go to the **Manage Customization Package** tab.
3. Upload your zipped package in the **Customization Package** field and save.
4. Refresh the front-end to see your changes.


---

## Additional Resources

### Live Demo Tutorial
- **Customize Primo NDE UI**: Watch our live demo on YouTube for a visual guide on how to customize the Primo NDE UI:
  [Customize Primo NDE UI: Live Demo](https://www.youtube.com/watch?v=j6jAYkawDSM)



---

## Conclusion
By following these steps, you can customize and extend the NDE interface using the `CustomModule` package. If you have any questions or run into issues, refer to the project documentation or the ExLibris support.

