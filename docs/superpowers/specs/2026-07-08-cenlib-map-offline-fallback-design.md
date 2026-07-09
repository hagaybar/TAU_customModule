# CenLib Shelf Map — same-origin bundled fallback (design)

> **Status:** Draft · 2026-07-08 · Author: Hagay Bar + Claude Code
> **Related:** CORS cache-poisoning outage (fixed 2026-07-08 by removing S3 CORS; CloudFront now serves `Access-Control-Allow-Origin: *`). This is the defense-in-depth follow-up so a *future* CDN/CORS failure degrades gracefully instead of silently hiding the Shelf Map button.

## Problem

The Shelf Map feature loads two things cross-origin from CloudFront:
- the mapping CSV (`…/data/mapping.csv`), via `ShelfMappingService`, and
- floor-plan SVGs (`…/maps/floor_N.svg`), via `ShelfMapSvgComponent`.

The button's visibility depends on `hasMappingAsync()` succeeding. If the CSV
fetch fails (CDN outage, CORS regression, network), `ShelfMappingService`
returns `[]` and the button **silently disappears** — exactly the failure mode
that made the 2026-07-08 CORS bug hard to notice. We want a bundled, same-origin
snapshot to fall back to.

## Key finding (verified in code)

The **SVG loader already has a same-origin fallback**: on a CDN error,
`ShelfMapSvgComponent.getFallbackSvgPath()` (shelf-map-svg.component.ts) maps the
CloudFront URL to a local `assets/cenlib-map/…` path and `loadSvgFromUrl()`
retries it. Three SVGs are already committed, and `src/assets` ships in the
Angular build (angular.json).

So the real gap is the **CSV**: `ShelfMappingService` has no fallback. Two
smaller issues ride along: the CDN→local mapping lives privately in the SVG
component (`LOCAL_SVG_MAP`), and the committed SVG filenames use inconsistent
casing (`Floor_1.SVG`) vs the CDN's lowercase `floor_1.svg`.

## Design

A single small module owns the fallback **policy**; each loader keeps its own
success handling (CSV parses, SVG injects). Sync of the bundled snapshot is a
**manual** dev script.

### 1. `cenlib-map/services/map-asset-fallback.ts` (new)

- `cdnAssetToLocalPath(url: string): string | null` — pure.
  - `${AWS_CDN_BASE_URL}/data/mapping.csv` → `assets/cenlib-map/mapping.csv`
  - `${AWS_CDN_BASE_URL}/maps/floor_<N>.svg` → `assets/cenlib-map/floor_<N>.svg` (lowercase)
  - non-CDN URL → `null`
  - Single source of truth for "which bundled file backs this CDN asset."
- `fetchTextWithFallback(http: HttpClient, cdnUrl: string): Observable<string>`
  - GET `cdnUrl`; on **any** error, if `cdnAssetToLocalPath(cdnUrl)` is non-null,
    GET `${assetBaseUrl}/${localPath}`; if that also errors (or no mapping),
    propagate the error.
  - Emits one gated `dwarn` when the fallback path is taken.

### 2. `ShelfMappingService` (edit)

Replace the raw `http.get(csvUrl, {responseType:'text'}).pipe(catchError(→[]))`
with `fetchTextWithFallback(this.http, csvUrl).pipe(map(parseCsv), catchError(→[]))`.
Net behavior:
- CDN healthy → unchanged.
- CDN fails, bundled CSV present → parse bundled CSV → button still works.
- both fail → `[]` (today's behavior; button hidden — **no regression**).

### 3. `ShelfMapSvgComponent` (edit — minimal)

Keep the existing load/inject flow. Swap the body of `getFallbackSvgPath()` to
delegate to the shared `cdnAssetToLocalPath()`, and **delete `LOCAL_SVG_MAP`**.
The CDN→local mapping now lives in exactly one place. *(The working fetch flow is
intentionally left as-is — no churn on code that already works.)*

### 4. Bundled assets

- Add `src/assets/cenlib-map/mapping.txt` (initial snapshot from CloudFront).
  **Bundled as `.txt`, not `.csv`:** Alma's custom-package upload rejects `.csv`
  files ("File type csv is not allowed in the zip file"). The content is still
  CSV — loaders read it with `responseType: 'text'` and Papa-parse it, so the
  extension is irrelevant to the code. `.txt` is confirmed allowed (Angular's
  `3rdpartylicenses.txt` already ships in the package). The CloudFront copy
  stays `mapping.csv`; only the bundled fallback is `.txt`.
- `git mv` the three SVGs to lowercase `floor_0.svg`, `floor_1.svg`, `floor_2.svg`
  to match the CDN and the new pure mapping. (SVG is allowed by Alma.)

### 5. Sync script

- `scripts/sync-map-assets.mjs` — Node 18 global `fetch`; downloads current
  `mapping.csv` + `floor_0/1/2.svg` from CloudFront into `src/assets/cenlib-map/`,
  prints byte sizes, reminds to `git add` + commit. CDN base URL + floor list
  hardcoded with a comment pointing at `data-source.config.ts` (it's a dev tool —
  YAGNI).
- `package.json`: `"sync:map-assets": "node scripts/sync-map-assets.mjs"`.
- Run deliberately before a deploy; the snapshot is committed to git.

## Data flow

- **Healthy CDN:** loader → `fetchTextWithFallback` → CDN 200 → parse/inject. Identical to today.
- **CDN down / CORS regression:** CDN errors → `cdnAssetToLocalPath` → same-origin `assets/cenlib-map/…` 200 → parse/inject → button works with last-synced data (one `dwarn`).
- **Both fail:** CSV → `[]`; SVG → `hasError`. Exactly today's behavior.

## Error handling & logging

No new failure surface — worst case is today's "button hidden." New/edited code
uses gated `dlog`/`dwarn` (`services/debug.util.ts`), never raw `console.*`
(project rule / issue #10). Converting the *existing* raw `console.*` throughout
cenlib-map is out of scope (separate cleanup).

## Testing

- `map-asset-fallback.spec.ts` (new): `cdnAssetToLocalPath` (csv, each floor svg,
  non-CDN→null); `fetchTextWithFallback` (CDN success → no fallback; CDN error →
  local success; both error → error). Mock `HttpClient`.
- `shelf-mapping.service.spec.ts` (extend): CDN error → bundled CSV parsed →
  mappings populated; both fail → `[]`.
- `shelf-map-svg.component.spec.ts`: still green after the `getFallbackSvgPath`
  swap.
- Manual (`start:proxy`): temporarily point `AWS_CDN_BASE_URL` at a bad host to
  force the fallback; confirm dialog + button render from bundled data.
- `npm run build` must pass before the PR.

## Out of scope

- OPTIONS preflight 403 (doesn't affect simple GETs).
- Converting all cenlib-map `console.*` → `dlog` (issue #10 territory).
- Build-time auto-sync (manual sync chosen).

## Delivery

Branch `feature/cenlib-map-offline-fallback` → PR against
`hagaybar/TAU_customModule` (never `main` directly; pass
`--repo hagaybar/TAU_customModule`). `main` is production for this repo, so the
PR is the review gate before deploy.
