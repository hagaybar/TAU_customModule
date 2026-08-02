# Results search bar flashes on the landing page (NDE host defect)

**Status:** cosmetically suppressed in `src/assets/css/custom.css`; real fix belongs to Ex Libris.
**Investigated:** 02.08.26 · **Affects:** every `/nde/home` load, all users, all languages.

## Symptom

On every landing-page load (including a plain refresh), the **results-page search bar**
appears for roughly 200–500 ms and then vanishes as the landing page renders. The user sees
a search box "pop in and disappear", plus the layout jump that goes with it.

## This is not a TAU customization bug

Reproduced on **production `972TAU_INST:NDE`**, which carries none of the code in this
repository — no announcement banner, none of the issue #28/#29/#31 CSS. It also predates
those changes entirely. TAU additionally observed the same behaviour on a **different
tenant**, [`01FALSC_EFSC:NDE_EFSC`](https://efsc-flvc.primo.exlibrisgroup.com/nde/home?vid=01FALSC_EFSC:NDE_EFSC&lang=en)
(Eastern Florida State College), which points to a product-level defect rather than a
tenant configuration issue.

> An automated probe against EFSC was **inconclusive** — the sampler was throttled to ~64
> samples in 7 s by main-thread blocking and probably missed the window. The EFSC report is
> a human visual observation; treat it as corroboration, not measurement.

## Mechanism (measured live on `972TAU_INST:NDE_TEST`)

The app boots into the **results-page structure** and only then tears it down to build the
landing page:

| Time | State |
|---|---|
| ~430–630 ms | `<nde-top-bar>` created as a **direct child of `div.search-container`**, *without* `.top-bar-not-sticky` — i.e. rendered in results mode. Chain: `div.search-container < main.sub-container < section.container < nde-app-layout` |
| ~630–1110 ms | still showing; the window varies with connection speed (observed 429–720, 434–631, 631–1110 ms across three loads) |
| then | the bar gains `.top-bar-not-sticky` and **moves** into `div.custom-search-bar-container < div.landing-search-background-image < nde-landing-search-section` |

For that whole window the landing page's DOM is byte-for-byte the results layout.

## Why the workaround looks the way it does

**JavaScript cannot help.** Asset timing, same page load:

| Asset | Arrives |
|---|---|
| `custom.css` | ~718 ms — **inside** the flash |
| `assets/js/custom.js` | ~1184 ms — **after** the flash has ended |
| custom-module remote (`remoteEntry.js`) | ~1320 ms — after |

So only `custom.css` is in play, and the fix has to be a pure CSS selector that can tell the
two routes apart *during* the flash.

**Most obvious discriminators are too late.** `nde-landing-page-renderer`,
`main.main-landing-page`, `.landing-search-background-image`, `.custom-search-bar-container`
and `nde-landing-about` all first appear at ~1008 ms — covering only the **last 30 %** of a
flash that starts at ~631 ms.

**What worked** was diffing the complete DOM (every tag, every class) at flash time between
the two routes. That surfaced `<nde-landing-page-config>`, which sits in a sibling subtree of
the *same* container as the spurious bar:

```
div.search-container
├── nde-top-bar                 <- the spurious bar
└── div.search-content
    └── nde-landing-page-config <- landing route only
```

Measured across **3 landing loads it is present for 100 % of the flash window**; across
**2 results loads it never appears at all**. Because it follows the bar in document order and
CSS has no preceding-sibling combinator, `:has()` is required.

## The rule

```css
.search-container:has(nde-landing-page-config) > nde-top-bar:not(.top-bar-not-sticky) {
  display: none !important;
}
```

**Safety properties:**

- `:not(.top-bar-not-sticky)` leaves the settled landing bar alone.
- The `:has()` clause cannot match on the results page — `nde-landing-page-config` never
  exists there.
- On a browser without `:has()` support the whole rule is dropped and behaviour degrades to
  today's flash. It can **never** hide the real results search bar.
- `display: none` rather than `visibility: hidden`, so no space is reserved and there is no
  layout jump.

**Verified** by injecting the rule before page scripts on the live test view:

| Route | Result |
|---|---|
| Landing | spurious bar **never rendered**; real landing bar still appears (h=74, `.top-bar-not-sticky`) |
| Results | search bar visible from 361 ms, continuous, **unaffected** (h=74) |

## For the Ex Libris case

Suggested framing:

> On views with the native landing page enabled (`loadLandingPage`), loading `/nde/home`
> renders the search-results top bar for ~200–500 ms before the landing page replaces it.
> `<nde-top-bar>` is created as a direct child of `div.search-container` without the
> `top-bar-not-sticky` class, then reparented into `div.custom-search-bar-container` once the
> landing renderer mounts. The result is a visible flash and layout shift on every landing
> page load. Reproducible on `972TAU_INST:NDE` with no custom package code involved, and
> observed on `01FALSC_EFSC:NDE_EFSC`. Please route the landing page so the results top bar
> is never mounted, or withhold the top bar from paint until the route is resolved.

Attach: the timing table above and the DOM chains for both phases.

**Remove this workaround once Ex Libris ships a fix** — it is keyed on an internal component
name (`nde-landing-page-config`) that they are free to rename without notice, the same way
the landing banner changed under us on 2026-07-07 (see
[Landing Banner Customization](../features/landing-banner-customization.md)).
