# Landing Banner & Search-Bar Customization — Playbook

**Purpose:** one place that says *what to change, where it lives, and which gotchas bite* for the
NDE home/landing banner — background image, overlay shading, heading font/color, and search-bar
width. Use this to avoid re-hunting selectors every time a tweak is requested.

> Scope: the **landing/home page hero** (the big banner with "Start your search here" + the search
> box) gets the detailed playbook treatment, because that's where the tweak-and-retweak happens.
> A **complete inventory of every rule in `custom.css`** is in the [Complete custom.css
> inventory](#complete-customcss-inventory) section near the end. Last verified live on
> `972TAU_INST:NDE`, 11 Jun 2026.

---

## Quick reference

Everything below lives in **one file**: `src/assets/css/custom.css` (Primo's host auto-loads it;
relative `url(...)` paths resolve from `assets/css/`).

| Knob | Comment block in custom.css | Selector | Current value |
|------|------------------------------|----------|---------------|
| Banner background image (per language) | `bilingual search background` | `.top-bar-background-image, .landing-search-background-image` | `images/homePageImages/search_background_{en,he}.png` |
| Overlay shading (on/off) | `disable background-overlay` | `.custom-search-bar-container .background-overlay` | rule **commented out** → shading **on** (host default, reverted 15 Jun 2026) |
| Heading font + color | `banner heading font` | (block **removed** — reverted 15 Jun 2026) | host default (white on `Noto Sans Display`) |
| Search-bar width | `landing search-bar width` | `.landing-search-background-image .top-bar-container` | `width:75%` (live host default is ~85%) |
| Bilingual logo | `bilingual logo` | `nde-logo img` | HE → `library-logo-he.png` |

Font files: `src/assets/fonts/assistant/assistant-{hebrew,latin-ext,latin}.woff2` (self-hosted).

---

## Critical gotchas — read before touching anything

1. **There are TWO host layouts, and they differ.** The search area renders differently depending
   on whether the *landing page* is enabled (`loadLandingPage`, set in Primo Back Office):
   - **Production NDE view = landing-page layout:** `nde-landing-search-section >
     .landing-search-background-image > .custom-search-bar-container > …`, and the heading is an
     **`<h2>`**.
   - **Local dev proxy (`npm run start:proxy`) = top-bar layout:** no landing section, heading is an
     **`<h1>`**, and `.landing-search-background-image` does **not exist**.
   - **Consequences:**
     - Heading rules must be **tag-agnostic** → `:is(h1, h2)`. Never hard-code `h2`.
     - Rules scoped to `.landing-search-background-image` (e.g. the search-bar width) **work on
       production but not on the local proxy**. That's expected — see #2.

2. **The local proxy does NOT reproduce the production banner.** Because the proxy renders the
   top-bar layout, `.landing-search-background-image`-scoped rules and the landing background image
   won't show locally. **Always verify banner changes against the live production view**, not just
   `localhost`. (See "Verify live" below.)

3. **`build-settings.env` differs per branch.** `main` → `VIEW_ID=NDE` (builds
   `dist/972TAU_INST-NDE.zip`); `feature/cenlib_map_multi_locations` → `VIEW_ID=NDE_TEST` (builds
   `dist/972TAU_INST-NDE_TEST.zip`). The asset path (`ASSET_BASE_URL`) and zip name change with it.
   **After any edit run `npm run build`** (it runs `prebuild.js` → regenerates
   `asset-base.generated.ts`, then zips). Upload the zip that matches the view you're deploying to.

4. **The host wins without `!important`.** All these rules override host CSS, so they use
   `!important` (and so should new ones). Match the existing convention.

5. **Two `<h2>`s in the container.** Besides the visible heading there's a screen-reader-only
   `<h2 class="visually-hidden">Search bar</h2>` (nested in `nde-top-bar`). The `> :is(h1,h2)`
   direct-child match plus `:not(.visually-hidden)` excludes it — keep both guards.

---

## The knobs, one by one

### 1. Banner background image (per language)
- **Block:** `bilingual search background`.
- EN uses `search_background_en.png`; HE (or `dir=rtl` when `lang` absent) uses `search_background_he.png`.
- Targets **both** `.top-bar-background-image` (results-page top bar) and
  `.landing-search-background-image` (landing). `!important` is required because the landing one
  overrides an inline style.
- **To change the artwork:** drop a new PNG into `src/assets/images/homePageImages/` and update the
  `url(...)`, or just overwrite the existing file names.

### 2. Overlay shading (the tint over the banner image) — yes/no
- **Block:** `disable background-overlay`.
- `.custom-search-bar-container .background-overlay { display:none !important; }` → shading **OFF**
  (banner image shows in its true colors, not tinted by the theme).
- **To turn shading back ON:** delete/comment this rule (host re-applies its overlay). Don't set
  `display:block` — let the host default return.

### 3. Heading font + color ("Start your search here" / "התחילו לחפש כאן")
- **Block:** `banner heading font`.
- **Font:** self-hosted **Assistant** (SIL OFL, free) — a Hebrew-native typeface with full Latin,
  so it styles **both** language variants. Loaded via three `@font-face` `unicode-range` subsets
  (hebrew / latin-ext / latin), variable weight `200 800` (covers the host's 600).
- **Color:** `#000` (black). Host default was white on `Noto Sans Display`.
- **Selector:** `.custom-search-bar-container > :is(h1, h2):not(.visually-hidden)` — tag-agnostic
  (see gotcha #1), excludes the SR label (gotcha #5). `font-weight` is left to the host.
- **To change the font:** see "Self-hosting a font" below. **To change the color:** edit the `color`
  value. (Black-on-light-blue is legible on the current banner; re-check contrast if the background
  artwork changes.)

### 4. Search-bar width
- **Block:** `landing search-bar width`.
- `.landing-search-background-image .top-bar-container { width:75% !important; margin-inline:auto !important; }`
- **Scoped to the landing banner on purpose:** `.top-bar-container` is *also* the results-page
  search bar; scoping to `.landing-search-background-image` leaves the results page untouched. To
  also narrow the results-page bar, drop the `.landing-search-background-image` prefix (verify both).
- `margin-inline:auto` keeps it centered in **LTR and HE/RTL** (verified). Use logical properties,
  not `margin-left/right`.
- **The `%` reference:** width resolves against `nde-top-bar`'s content box, not the literal screen.
  Host default ≈ **85%**. Rough visual guide (relative widths of the search box):
  `100% ≈ full`, `85% = current host default`, `75% = current setting`, `60% = clearly narrow`.
  Just change the number; re-verify live.

### 5. Bilingual logo (related)
- **Block:** `bilingual logo`. HE UI swaps the logo image via `content: url(library-logo-he.png)`
  (CSS can't rewrite `<img src>`, but `content:` repaints it and preserves `alt`). EN uses the
  default `library-logo.png`.

---

## Complete custom.css inventory

Every rule block currently in `src/assets/css/custom.css`, top to bottom. The file uses dated/named
`/* … */` comment fences around each block — search those names rather than line numbers (which
drift). Banner/landing rows are detailed in the sections above.

### Banner / landing (detailed above)

| Comment fence | Selector | Effect |
|---|---|---|
| `disable background-overlay` | `.custom-search-bar-container .background-overlay` | rule **commented out** (reverted 15 Jun 2026) — banner shading **on** (host default) |
| `bilingual logo` | `html[lang="he"] nde-logo img`, `html:not([lang])[dir="rtl"] nde-logo img` | HE logo via `content: url(library-logo-he.png)` |
| `bilingual search background` | `.top-bar-background-image, .landing-search-background-image` (+ HE variants) | per-language banner PNG |
| `banner heading font` | _(block removed — reverted 15 Jun 2026)_ | host default heading (white on `Noto Sans Display`); see §3 to re-add Assistant |
| `landing search-bar width` | `.landing-search-background-image .top-bar-container` | `width:75%`, centered |

### Account / GetIt / results display

| Comment fence | Selector | Effect |
|---|---|---|
| `Hide Update Login Credentials in MyAccount` | `.mat-mdc-card-actions` | `display:none` (hides the card actions in My Account) |
| `color change and bold for library name - NDE` | `.getit-library-title.mat-title-medium` | `color:#44707b; font-weight:bold` |
| `color change and bold for library name` (AngularJS) | `prm-location-items .tab-content-header .md-title`, `md-list-item … h3` | `#44707b` + bold — **legacy pre-NDE view only; inert in NDE** |
| `location unavailable change text color` | `.view-it-title.mat-title-small.ng-star-inserted span` | `color:green` |
| `bold the thext fine` | `mat-card-title.mat-mdc-card-title.margin-bottom-medium` | `font-weight:bold` (the fines/fees amount) |
| `Call Number Directionality Fix - NDE View` | `nde-locations-container [data-qa="location-call-number"]` | `direction:ltr; unicode-bidi:embed; display:inline-block; font-weight:bold` |
| `Call Number Directionality Fix - …Brief Properties` | `nde-location-item .getit-items-brief-property:nth-child(3) span[ndetooltipifoverflow]` | same LTR fix for the collapsed/brief view |

> **BiDi note:** the call-number rules force LTR so e.g. `892.413 מאו` keeps digits on the left
> regardless of UI language. `nth-child(3)` is the call-number column in the brief 3-column layout.

### Global typography

| Comment fence | Selector | Effect |
|---|---|---|
| `Adjust base font size for entire Primo NDE view` | `nde-app-root, nde-view, prm-search, prm-brief-result, prm-full-view, prm-facet, body` | `font-size:16px !important; line-height:1.5; font-family:'Roboto','Helvetica Neue',sans-serif !important` |

> Caveat: theme/typography only reliably affects the listed custom/host elements, not 100% of Primo.

### Components / RTL fixes

| Comment fence | Selector | Effect |
|---|---|---|
| `Snackbar surface background` | `mat-snack-bar-container.mat-mdc-snack-bar-container`, `… .mdc-snackbar__surface` | `--tau-snackbar-bg` / `background-color: #fffde7` (pale-yellow snackbar) |
| `Fix two-button group alignment in RTL` | `html[dir="rtl"] .dropdown-group` | `flex-direction:row-reverse` |
| `Fallback … browzine button` | `.ti-browzine-button-container .ti-custom-button-text custom-svg-icon / .icon` | `margin-inline-start:0.2rem` (icon/text gap) |
| `Add space between PDF button text and icon` | `.mdc-button__label .quicklink-button-text` | `margin-inline-end:0.2rem` |

> Most rules use `!important` to beat host CSS, and RTL/spacing rules use **logical** properties
> (`margin-inline-*`, `flex-direction:row-reverse` under `[dir="rtl"]`) so they work in HE and EN.

---

## Standard workflow for any of the above

1. **Edit** the relevant block in `src/assets/css/custom.css` (keep the dated `/* … */` comment
   convention; add a new dated block for a new knob).
2. **Build:** `npm run build` → regenerates the asset-base file and produces
   `dist/972TAU_INST-<VIEW_ID>.zip`. (Mandatory after *any* change; see gotcha #3.)
3. **Verify live** (below) — both EN and HE.
4. **Deploy:** upload `dist/972TAU_INST-<VIEW_ID>.zip` in **Alma Back Office → custom package
   section**. The commits/build alone don't deploy; the upload does.

---

## Verify live (Playwright recipe)

The reliable way to confirm a banner change is to inspect the **live production** page (the local
proxy renders a different layout — gotcha #2).

- URLs: `https://tau.primo.exlibrisgroup.com/discovery/search?vid=972TAU_INST:NDE&lang=en` (and
  `&lang=he`). Both redirect to `/nde/home`.
- To **preview a change before shipping**, inject CSS in the page and screenshot — e.g. to test a
  width: add a `<style>` with `.landing-search-background-image .top-bar-container{width:NN% !important;margin-inline:auto !important;}`
  and screenshot `.landing-search-background-image`.
- To **confirm self-hosted fonts load**, run the dev proxy and check the woff2 request returns
  `200` from `…/972TAU_INST-<VIEW_ID>/assets/fonts/assistant/…` (the local proxy *does* serve the
  font path even though it renders the top-bar layout).
- **Screenshot the element, not via scroll:** screenshotting a small element (e.g. `nde-top-bar`)
  can scroll it under the sticky page header and capture the wrong thing. Screenshot the larger
  `.landing-search-background-image` instead.

---

## DOM anatomy (landing page, for reference)

```
.landing-search-background-image            (full-width banner; bg image; landing-only)
└─ .custom-search-bar-container             (flex, justify-center; holds heading + search)
   ├─ .background-overlay                    (the tint — hidden by our rule)
   ├─ <h2 or h1>  "Start your search here"   (the heading we restyle)
   └─ nde-top-bar.top-bar-not-sticky
      └─ .top-bar-container                  (flex, justify-center — the width knob)
         └─ nde-search-bar-container.grid-item
            └─ nde-search-bar-presenter
               └─ .search-bar-container
                  └─ .flex-row.flex-1
                     └─ .search-bar-wrapper.landing-page-search-bar-wrapper
                        └─ .search_box_container
                           └─ input.search-in   (the actual text field)
```

---

## Self-hosting a font (how the Assistant files got there)

The three woff2 subsets were pulled from Google Fonts (already woff2, subsetted) and placed in
`src/assets/fonts/assistant/`. To replace with another font, repeat:

1. `curl -A "<modern browser UA>" "https://fonts.googleapis.com/css2?family=<Family>:wght@<range>&display=swap"`
   → gives `@font-face` blocks with `fonts.gstatic.com` woff2 URLs + `unicode-range`s.
2. `curl` each woff2 into `src/assets/fonts/<family>/` (verify the header bytes are `wOF2`).
3. Copy the `@font-face` blocks into custom.css, changing each `src: url(...)` to the local
   `../fonts/<family>/<file>.woff2` path. Keep the `unicode-range` lines (they make the browser fetch
   only the subset it needs — e.g. Hebrew subset only loads on the HE page).

`src/assets` is copied wholesale into `dist` by the Angular build, so new font files ship
automatically.

---

## Deploy targets at a glance

| Branch | `VIEW_ID` | Build output | Primo view |
|--------|-----------|--------------|------------|
| `main` | `NDE` | `dist/972TAU_INST-NDE.zip` | Production |
| `feature/cenlib_map_multi_locations` | `NDE_TEST` | `dist/972TAU_INST-NDE_TEST.zip` | Test |

Upload the matching zip in Alma Back Office → custom package section.
