# NDE smoke test

Checks a **deployed** view: every mapped component still mounts, and representative
`custom.css` selectors still match the host's markup. Written for issue #75 (Primo NDE moves
to Angular 20 in the February 2027 release); worth running after any Primo release.

It builds nothing. It loads public pages on the target, and opens the Shelf Map dialog once,
with Mixpanel blocked so the click is not counted as a patron's.

```bash
npx playwright install chromium            # once per machine
npm run test:smoke                         # live NDE
SMOKE_VID=972TAU_INST:NDE_TEST npm run test:smoke
SMOKE_BASE_URL=http://localhost:4201 npm run test:smoke   # the local build, through npm run start:proxy
npx playwright show-report                 # after a failure: screenshots and traces
```

| Variable | Default | Meaning |
|---|---|---|
| `SMOKE_BASE_URL` | `https://tau.primo.exlibrisgroup.com` | Primo host, or the dev proxy |
| `SMOKE_VID` | `972TAU_INST:NDE` | View; the boot banner must name the matching package |
| `SMOKE_TAB`, `SMOKE_SCOPE` | `TAU`, `TAU` | Search tab and scope. Must exist in the view: an unknown tab leaves the host filter panel empty and fails the filter-assist check |
| `SMOKE_SHELF_DOCID` | `alma990020446760204146` | A Central Library print book that shows the Shelf Map button |

## What it checks

| Check | Page | Passes when |
|---|---|---|
| Boot | search results | console prints `[TAU] custom module · <INST>-<VIEW> · …`; announcement banner visible |
| No-results links | zero-hit search | `section.tau-external-search` with 3 links |
| Shelf Map | full record | `button.cenlib-map-button` visible; click opens `.cenlib-map-dialog-panel` |
| Collection Discovery | `/nde/collectionDiscovery` | collections in `hidden-collections.config.ts` are hidden and marked |
| Filter-assist panel | search results | `section.external-search-panel` with 3 links |
| `custom.css` | home, results, full record | stylesheet loaded; listed selectors match at least one element |

Every test also fails on any error raised from the package's own URLs (`/nde/custom/…`). The
host's own errors are ignored, as is the 404 for `CENTRAL_CODE.txt`, a file the host probes for.

The boot test prints `ng-version: host X · ours Y`. On 2026-10-05 that read
`host 19.1.3 · ours 18.2.x`: our components run on our own bundled Angular, not the host's
(see `docs/reference/nde-dependency-surface.md` §1). Watch this line on upgrade day.

## When it fails

- A selector check fails → the host markup changed; find the rule in
  `docs/reference/nde-dependency-surface.md` §4.2 and adjust `custom.css`.
- Shelf Map fails but nothing else does → first check the record still exists and is still in a
  mapped Central Library location (pick another with `SMOKE_SHELF_DOCID`), and that CloudFront
  serves `mapping.csv`.
- Retries are set to 1: "flaky" in the summary means a live-site hiccup, not a break.
