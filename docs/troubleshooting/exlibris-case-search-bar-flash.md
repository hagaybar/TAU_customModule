# Ex Libris case draft — search bar flashes / jumps on NDE landing-page load

> **This file is the text to send to Ex Libris.** It deliberately reports **only what can be
> observed and measured**. It does not diagnose a cause and does not propose a fix — that is
> Ex Libris's to determine.
>
> Internal notes (mechanism, and the interim CSS suppression TAU applied) are kept separately
> in [`landing-page-search-bar-flash.md`](landing-page-search-bar-flash.md) and should **not**
> be sent with this case.

---

## Summary

On the NDE landing page (`/nde/home`), the search box does not render in its final position on
first paint. It appears in one place, then — several hundred milliseconds later — either
**moves to a different position** or **disappears and reappears**. The user sees the search bar
flash or jump on every page load, including a plain refresh.

This is **not specific to one institution**. It reproduces on multiple unrelated Primo NDE
views in different countries, including views that use no custom code from us.

## How to reproduce

1. Open any affected NDE landing page URL from the table below.
2. Reload the page (a normal refresh is enough).
3. Watch the search box during the first ~1–3 seconds of load.

The effect is more pronounced on a slower connection or a cold cache. Throttling the network
in browser dev tools makes it obvious.

## Measured evidence

Each view below was loaded **three times in a fresh browser profile** (no extensions, no cached
state). During each load the on-screen rectangle of the search input was recorded via a
`MutationObserver` plus `requestAnimationFrame` sampler, so nothing was missed by polling. Times
are milliseconds from navigation start.

| Institution | View ID | Observed behaviour | Reproduced | Duration of the transient state |
|---|---|---|---|---|
| **Tel Aviv University** (IL) | `972TAU_INST:NDE` | search box renders at **y=81**, then **jumps to y=288** — a 207 px vertical shift | **3 / 3 loads** | 490 ms, 481 ms, 567 ms |
| **IHP** (IL) | `972HAI_IHP:IHPC` | search box appears, **disappears**, then reappears | **3 / 3 loads** | 411 ms, 320 ms, 461 ms |
| **Broward College** (US) | `01FALSC_BRC:NDE_BRC` | search box appears, **disappears**, then reappears | **3 / 3 loads** | 373 ms, 370 ms, 570 ms |
| **Eastern Florida State College** (US) | `01FALSC_EFSC:NDE_EFSC` | search box appears, **disappears**, then reappears | **1 / 3 loads** | 360 ms |
| *Huddersfield* (UK) — control | `44HUD_INST:HUD` | not observed | 0 / 3 loads | — |

**Totals: reproduced on 4 of 5 views tested, across 2 countries, in 10 of 12 affected-view loads.**
Huddersfield is included deliberately as a negative control, to show the measurement does not
simply report a flash on every NDE view.

### Example timeline — `972TAU_INST:NDE`, three consecutive loads

Position of the search input, recorded as it changed:

```
load 1:   2054ms  top=81  h=40      2544ms  top=288 h=40     (jump after 490ms)
load 2:   2083ms  top=81  h=40      2564ms  top=288 h=40     (jump after 481ms)
load 3:   2083ms  top=81  h=40      2650ms  top=288 h=40     (jump after 567ms)
```

The search box is painted at `y=81` — near the top of the viewport — and then relocated to
`y=288` roughly half a second later. Both states are visible to the user.

### Example timeline — `972HAI_IHP:IHPC`

```
load 1:  search box visible 2058→2500ms (442ms), disappears, visible again from 2516ms
```

## Direct URLs

- `https://tau.primo.exlibrisgroup.com/nde/home?vid=972TAU_INST:NDE&lang=en`
- `https://ihp.primo.exlibrisgroup.com/nde/home?vid=972HAI_IHP:IHPC&lang=he`
- `https://brc-flvc.primo.exlibrisgroup.com/nde/home?vid=01FALSC_BRC:NDE_BRC&lang=en`
- `https://efsc-flvc.primo.exlibrisgroup.com/nde/home?vid=01FALSC_EFSC:NDE_EFSC&lang=en`
- Negative control: `https://librarysearch.hud.ac.uk/nde/home?vid=44HUD_INST:HUD&lang=en`

## Attachments

Screen recordings of the loads measured above, one folder per institution
(`.webm`, 1280×720):

```
TAU/      TAU_972TAU_INST-NDE_load1..3.webm
IHP/      IHP_972HAI_IHP-IHPC_run1..3.webm
BROWARD/  BROWARD_01FALSC_BRC-NDE_BRC_run1..3.webm
EFSC/     EFSC_01FALSC_EFSC-NDE_EFSC_run1..3.webm
HUD/      CONTROL_HUD_44HUD_INST-HUD_load1..3.webm   (control — effect not present)
```

## Impact

The landing page is the entry point for all users of the discovery interface. On every visit,
the primary search control visibly jumps or flickers before settling. Beyond the cosmetic
problem, the layout shift means a user who reaches for the search box immediately can have it
move out from under the pointer or cursor.

## What we are asking

Please confirm the behaviour and advise whether it is a known defect and whether a correction
is planned.
