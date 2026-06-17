# Loading Animation Stays Purple, Ignores the View Color Theme

**Status:** ✅ Answered by Ex Libris — the **entire** loading animation can be replaced via the
customization package (a custom Lottie JSON file). The default animation's **color alone cannot be
changed** (see Root Cause); the supported path is to ship your own animation. See **Resolution** below.
**Ex Libris Case:** **10665359** (opened 2026-06-17; answered 2026-06-17 by Moshe H.)
**Affected:** Primo NDE host application (vendor side).
**Verified on:** view `972TAU_INST:NDE_TEST`, color theme set to the **"red"** preset.

---

## Overview / Symptom

When an NDE view first loads (most visible in an incognito window / cold cache), Primo shows a
loading animation made of moving/pulsing circles ("dots"). Those circles render in the **default
purple `#5e42d8`** even after a different color theme is configured for the view in Alma.

Changing the view's color theme **does** recolor the rest of the UI (in our test, to red `#b91c1e`)
— but the loading animation keeps the default purple. The animation's **color is the only
customizable aspect**; its shape and motion are host-owned and not exposed.

## Root Cause (verified)

The boot "four purple dots" **is a Lottie animation** the host fetches at startup from the custom
package (`{custom-package}/assets/images/loadingAnimations/LoadingAnimationJson.json`), falling back
to the host default (`/nde/assets/images/loadingAnimations/LoadingAnimationJson.json`) when the
package ships none. The dot colors are **baked into that Lottie** as animated shape fills cycling
through purple shades (verified by parsing the live file):

`[0.149,0,0.494]` ≈ `#26007e` → `[0.216,0,0.702]` ≈ `#3700b3` → `[0.471,0.325,0.8]` ≈ `#7853cc` →
`[0.757,0.69,0.906]` ≈ `#c1b0e7`.

These are **hardcoded in the JSON and not driven by the view theme** — which is exactly why changing
the Alma color theme had no effect on the dots.

> **Correction:** an earlier draft attributed the dots to a CSS spinner
> `.primary-circle svg g circle { fill: var(--sys-primary) }`. That element exists and *does* follow
> the theme token (`--sys-primary`: `#5e42d8` baseline → `#b91c1e` after the per-view
> `custom-color-theme-red.css` loads), but it is a **separate** in-UI spinner, **not** the boot dots.
> The boot dots are the Lottie above. (Kept here because the `--sys-primary` load-order detail is
> still accurate for that other spinner.)

## How it was verified (2026-06-17)

Inspected the live production assets and the rendered `NDE_TEST` page (Playwright + Chrome DevTools
network throttling):

- The served app shell (`/nde/`) starts `<body … style="visibility: hidden">` and links
  `nde-color-theme.<hash>.css` — confirming the loader paints during the host's bootstrap, before
  this custom module is even loaded.
- `getComputedStyle(document.documentElement)` for `--sys-primary`:
  - **during cold boot:** `#5e42d8` (purple)
  - **after full load:** `#b91c1e` (red)
- Two `--sys-primary` definitions found in `document.styleSheets`: baseline `nde-color-theme.css`
  (`#5e42d8`) and `custom-color-theme-red.css` (`#b91c1e`).
- **Causation check:** artificially delaying `custom-color-theme-*.css` kept the whole page on the
  baseline purple for longer — confirming that file is what flips the color and that it arrives
  after the animation.

## Why you cannot just *recolor* the default animation

- The loader, the baseline `--sys-primary`, and the order in which the per-view theme file loads are
  all part of the **Ex Libris host application** — not configurable from Alma or from this module.
- This module's `src/assets/css/custom.css` loads **even later** than `custom-color-theme-red.css`,
  so a `--sys-primary` override there cannot win the cold-boot race either.
- Activating the module's M3 theme (`_customized-theme.scss` / `m3-theme.scss`) recolors the app but
  also loads too late for the boot animation's first paint.

→ You cannot change *only the color* of the default dots. The supported approach is to **replace the
whole animation** (see Resolution).

## Resolution: replace the animation with a custom Lottie file

Per Ex Libris (Case 10665359) and the official docs
([Customization Best Practices](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/Go_NDE/Customization_Best_Practices)),
the default loading animation (described in the docs as "four purple dots") can be replaced from the
customization package. **Verified against the official documentation 2026-06-17** (the support
email's `Text…`-prefixed filenames were copy-paste artifacts; the values below are the verified ones):

- **Format:** Lottie (JSON).
- **Exact filename (case-sensitive):** `LoadingAnimationJson.json`
- **Path the host actually requests (verified live, see below):**
  `{custom-package}/assets/images/loadingAnimations/LoadingAnimationJson.json`
- **Size/structure:** no hard requirement, but keep it small for fast load.

> The official doc says "`images/loadingAnimations/`"; for the **NDE Angular custom-module package**
> that path is relative to the package's **`assets/`** folder, not the package root. Confirmed by the
> host's own boot request (below) — do **not** put it at the package root.

### Build wiring for THIS repo (no config change needed)
`angular.json` copies `src/assets` → `dist/<pkg>/assets/`, so simply place the file at:

```
src/assets/images/loadingAnimations/LoadingAnimationJson.json
```

`npm run build` then emits it to
`dist/972TAU_INST-NDE/assets/images/loadingAnimations/LoadingAnimationJson.json`, which is served at
exactly the URL the host probes. Upload the package via Alma → Manage Customization Package for the
NDE view. (No `angular.json` asset-mapping change is required.)

### How the path was verified (2026-06-17, live network capture)
On cold boot of `NDE_TEST`, the host makes **two** requests:
- `…/nde/custom/972TAU_INST-NDE_TEST/assets/images/loadingAnimations/LoadingAnimationJson.json` → **404**
  (our package — currently empty, so it falls back)
- `…/nde/assets/images/loadingAnimations/LoadingAnimationJson.json` → **200** (the host default = the purple dots)

Placing our file at the first URL's path replaces the default. This empirical probe (404 vs 200) is
why we did **not** need to re-ask Ex Libris to disambiguate the email's wording.

> Note: a custom Lottie animation carries its **own** colors (baked into the JSON); it does **not**
> follow the view's `--sys-primary` theme color. Author it in the desired color (e.g. TAU brand).

### TAU's shipped animation
`src/assets/images/loadingAnimations/LoadingAnimationJson.json` is the Ex Libris default four-dot
Lottie **hue-rotated from violet to azure blue** (`#003b7e → #0052b3 → #538bcc → #b0c9e7`), keeping the
original motion/structure. It replaces the default purple dots with a blue set that fits a blue Primo
NDE theme. Built on branch `feat/nde-loading-animation-blue`; verified via the proxy dev server
(served at the host-requested path, HTTP 200) and rendered with lottie-web. Colors are baked into the
JSON — to re-tune, hue-rotate or recolor the fill keyframes (they are animated `fl` fills).

## References

- Theme configuration guide: [`NDE_THEME_CUSTOMIZATION.md`](../development/NDE_THEME_CUSTOMIZATION.md)
- Related host-layout quirk: [`landing-banner-customization.md`](../features/landing-banner-customization.md)
