# Landing-page quick links: open external links in a new tab

**Status:** implemented in `src/assets/js/custom.js`
**Date:** 2026-09-03
**Applies to:** views using the native NDE landing page (`loadLandingPage: true`) — `NDE`, `NDE_TEST`

## The request

Clicking one of the landing-page quick links ("the cubes") replaces the landing page in the
same tab. The library wants them to open in a new tab so the search page is not lost.

Reference views where this already works, supplied with the request:

| View | URL |
|---|---|
| British Library | `https://catalogue.bl.uk/nde/home?vid=44BL_MAIN:BLL01_NDE` |
| 3M Library | `https://mmm.primo.exlibrisgroup.com/nde/home?vid=013MKDA_INST:NDE_PROD` |
| Angelo State University | `https://angelo.primo.exlibrisgroup.com/nde/home?vid=01ANGELO_INST:01ANGELO_INST_LIVE_NDE` |
| RMIT University | `https://rmit.primo.exlibrisgroup.com/nde/home?vid=61RMIT_INST:RMITU_AU` |

**All four use a different landing page than we do.** Their DOM shows
`nde-landing-page > div.home-page-container` holding raw uploaded HTML (`<base href>`, `<meta>`,
`<link href="./homepage.css">`) — i.e. the legacy custom homepage, where the anchors are
hand-written and `target="_blank"` is typed in by the library. TAU runs the *native* landing page
(`nde-landing-page-config > nde-landing-page-renderer > nde-landing-section-host >
nde-landing-quick-links`), where the anchors are rendered by Ex Libris. So their solution is not
a setting we can copy; it is a different landing page.

## What the host actually supports

The native renderer **does** support new-tab links. From the host bundle
(`/nde/src_bootstrap_ts.<hash>.js`, component `nde-landing-quick-links`):

```js
("href",  M.hrefFor(s) || null, sanitizeUrl)
("target", s.openInNewTab ? "_blank" : null)
("rel",    s.openInNewTab ? "noopener noreferrer" : null)
// aria-label += s.openInNewTab ? " - " + translate("nde.aria.opensInaNewTab") : ""
```

It reads `openInNewTab` from the per-view file served at:

```
/nde/custom/972TAU_INST-NDE/assets/landingpage/landingpage.json
```

Every TAU link currently has `"openInNewTab": false` — on both `NDE` and `NDE_TEST`.

## Why this is not a Back Office change

- Ex Libris documents the Landing Page tab
  (Configuration > Discovery > Display Configuration > Configure Views > [view] > Landing Page)
  as exposing **Label / URL / Icon** per link. There is no "open in new tab" control.
  See [Overview of the NDE Interface and Configuration](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/Go_NDE/Overview_of_the_NDE_Interface_and_Configuration).
- The `openInNewTab` field is therefore present in the schema and honoured at runtime, but not
  reachable by a library. This matches the known limitation reported by Ex Libris.
- We cannot ship a corrected file either: `assets/landingpage/` is **not** part of this
  customization package. It is injected per view by Ex Libris. Verified — our `dist/` build
  contains no `landingpage` folder, the upstream `ExLibrisGroup/customModule` template has no
  `src/assets/landingpage`, and `NDE` and `NDE_TEST` are served two *different*
  `landingpage.json` files (different icons, different link order).

The same `assets/landingpage/` out-of-band ownership already bit us once — see the
"native landing page banner" note in the main [README](../../README.md) and
[landing-banner-customization.md](landing-banner-customization.md).

## The fix

`src/assets/js/custom.js` — a host-loaded plain script (already fetched by the host at
`/nde/custom/<INST>-<VIEW>/assets/js/custom.js`, previously an empty placeholder). It sets
`target="_blank"`, `rel="noopener noreferrer"` and the host's own aria suffix on the quick-link
anchors, exactly as the renderer would have if the flag were set.

Design points:

- **External links only.** Absolute `http(s)` to a different host. The library-card link
  (`/nde/account/overview?...`) is an in-app Primo route and stays in the same tab — opening the
  SPA a second time is worse than navigating.
- **Idempotent writes.** Attributes are only written when not already correct, so the
  `MutationObserver` cannot retrigger itself.
- **Two observers.** `childList` on `document.body` catches the landing page mounting;
  `attributeFilter: ['lang','dir']` on `<html>` catches an in-app language switch, which reuses
  the same anchors and only swaps their `href`/`aria-label` (a `childList` observer would miss it).
- **Accessibility.** The host appends `nde.aria.opensInaNewTab` to the aria-label when the flag is
  set — `"(Opens in a new tab)"` / `"(נפתח בלשונית חדשה)"`. Those two strings are mirrored in the
  script and re-applied after a language switch. If Ex Libris changes the label text, the aria
  suffix drifts; the `target` behaviour does not.

## Verification

Run live against production `NDE` before the code was written (script injected via devtools):

- Three external cubes received `target="_blank" rel="noopener noreferrer"`; the library-card
  link was correctly left alone.
- Clicking "Databases" opened a second tab; the landing page stayed loaded and focused in tab 1.
- Switching EN → HE in-app: `href`s swapped to the Hebrew URLs, `lang`/`dir` became `he`/`rtl`,
  and `target="_blank"` survived on all three.

## Removing this later

Delete the logic in `custom.js` once **either**:

1. Ex Libris exposes `openInNewTab` in the Landing Page tab and the flag is set on the view, or
2. Ex Libris support sets `openInNewTab: true` directly on the view's `landingpage.json`.

Worth opening a case / NERS request for (1) regardless — this script is a workaround for a gap in
the Back Office, not a TAU design decision.
