# Design: Multi-library support for the CenLib Shelf-Map feature

**Date:** 2026-07-13
**Status:** Draft — approved in brainstorming, pending spec review
**Scope:** Cross-repo — producer `primo_maps` (`NDE_MAPS_MANGER`) **and** consumer `TAU_customModule` (this repo)
**Driver:** Add a second physical library — **The Neiman Library of Exact Sciences and Engineering** (`הספרייה למדעים מדויקים ולהנדסה ע"ש ניימן`, 2 floors) — alongside the existing Sourasky Central Library.

---

## 1. Context & problem

The Shelf-Map feature is a producer/consumer pair:

- **Producer** (`primo_maps`): a vanilla-JS admin SPA + ~25 AWS Lambdas that author, validate, version, and publish a shelf-mapping **CSV** and floor-plan **SVGs** to an AWS CloudFront CDN.
- **Consumer** (`TAU_customModule`): an Angular add-on loaded into Primo NDE that fetches that data and renders a "Shelf Map" button + dialog.

The **data format** already carries a library dimension (`libraryName`/`libraryNameHe` columns; the consumer's lookup keys on *library + collection + Dewey range*). But **every system around the format is built for one building**:

- Producer admin hardcodes `SINGLE_LIBRARY = "Sourasky Central Library"`; there is no library selector, no per-library scoping.
- Floor set is hardcoded to `{0,1,2}` in 6+ producer files.
- Storage paths have **no library dimension**: `data/mapping.csv`, `maps/floor_{n}.svg`, `versions/…`, `staging/…` are all flat. A second building's floors would collide.
- Versioning, staging, and publish are **whole-file and global**; roles (`admin`/`editor`) are **operation-scoped only**, with no concept of "this user owns this library."

Neiman has **2 floors** vs Sourasky's 3 — so even the floor set must become per-library.

## 2. Goals / non-goals

**Goals**
- Support N libraries (starting with 2), each with its own CSV, floor SVGs, version history, and staging.
- **Per-library operators**: a user's access is limited to their library(ies); admins see all (and *may* be scoped); the admin UI has an active-library selector so views never mix libraries.
- **End-to-end isolation** ("separate all the way"): libraries are independent from the operator's keyboard to the patron's screen — no shared file assembled in the middle.
- Keep the call-number ordering parity contract with the consumer intact.
- Migrate live Sourasky into the new layout with no outage and no staleness.

**Non-goals**
- No change to the Dewey call-number ordering logic (`compareDeweyNumbers` / `isInDeweyRange`) — it stays byte-for-behaviour identical across producer and consumer.
- No cross-library operations (e.g. moving a collection between libraries) in this iteration.
- Authoring Neiman's actual map data (SVGs + CSV rows) is a separate effort, not part of this design.

## 3. Decision & rationale

**Chosen approach: "Isolated everything, unified nowhere" — separate per-library files all the way to the consumer.**

- Producer stores each library under its own S3 prefix (`data/<code>/…`, `maps/<code>/…`, `versions/<code>/…`, `staging/<code>/…`), with per-library versioning, staging, publish, and access scope.
- Consumer fetches each library's CSV **in parallel** and merges them into its (already library-keyed) lookup index. Each library's floor SVGs load from its own namespaced path.
- One admin app with an active-library switcher; one deployment; no separate per-library apps.

### Alternatives considered

- **A — Shared single CSV + filtered views.** Keep one `mapping.csv`; add a UI/role filter. *Rejected:* versioning and publish stay global (no per-library rollback; a Neiman save re-publishes the whole file and can block Sourasky on a validation error); isolation is only a UI filter over a shared file — too weak for the operator model.
- **B — Duplicate the whole app per library.** *Rejected:* duplicates admin surface and needlessly complex for 2–3 libraries.
- **C-assemble — Per-library authoring, merged into one published CSV.** Consumer stays single-fetch; producer runs an assemble-on-publish step. *Rejected in favour of "separate all the way":* the assemble step reintroduces a shared publish chokepoint (a bad merge poisons all libraries) and gives no runtime fault isolation. The user accepted the (bounded) consumer-side overhead of multi-fetch, which removes the assemble step entirely and makes the producer *simpler*.

The consumer overhead is bounded and partly free: `library.config.ts` is already edited per new library (for gating + SVG path), so adding a `csvUrl` field is marginal; the lookup index already keys by `libraryName`, so merging N CSVs needs no new indexing logic; and per-library fetch buys **runtime fault isolation** (one library's data failing can't hide another's buttons).

---

## 4. Design

### 4.1 Library registry + auth scope (foundation)

**Registry — one committed source of truth.** A shared module imported by both the admin SPA and the Lambdas:

```js
// shared/libraries.mjs
export const LIBRARIES = [
  { code: 'sourasky', nameHe: 'הספרייה המרכזית סוראסקי',
    name: 'Sourasky Central Library', floors: [0, 1, 2] },
  { code: 'neiman',   nameHe: 'הספרייה למדעים מדויקים ולהנדסה ע"ש ניימן',
    name: 'The Neiman Library of Exact Sciences and Engineering',
    floors: [/* Neiman floor numbers — TO CONFIRM: [1,2] vs [0,1] */] },
];
```

- `code` is a stable slug driving every storage path; never changes once set.
- `floors` is per-library — replaces the hardcoded `{0,1,2}`.
- Committed (not runtime-editable) because adding a library is already a deliberate deploy event; mirrors the repo's existing shared-module pattern.

**Auth gains a second, orthogonal dimension.**

- `role` (unchanged matrix): `admin` = all operations; `editor` = read/write/restore-versions (no delete, no manage-users). Naming kept as-is (operator ≡ editor).
- New **`libraries` claim** per user: a list of codes or `*` for all. Operator → `{ role: editor, libraries: ['neiman'] }`; admin → `{ role: admin, libraries: ['*'] }` by default, narrowable to specific codes.
- Stored as a Cognito custom attribute `custom:libraries`; read by `auth-middleware.mjs` into the user object; surfaced/edited in the user-management dialogs (library multi-select).

**Enforcement (must be server-side, not UI-only).** A new shared helper:

```js
// role-auth.mjs
checkLibraryScope(user, libraryCode) // → { allowed, reason, statusCode }
```

Every library-bound Lambda reads the target `libraryCode` from the request and must pass **both** `checkPermission(user, op)` **and** `checkLibraryScope(user, libraryCode)` before acting. The on-screen active-library switcher is convenience only; this check is the wall. Enforced on: `getCsv`, `putCsv`, `uploadSvg`, `uploadStagingSvg`, `listSvg`, `deleteSvg`, `validateStaging`, `promoteStaging`, `getStagingStatus`, `listVersionsCsv`, `listVersionsSvg`, `getVersion`, `restoreVersion`, `applyReconcileToStaging`.

**Active-library selector (UI).** A header switcher populated from `registry ∩ user.libraries`. Operators scoped to one library see it fixed; multi-library users/admins get a dropdown. Selecting sets "active library" in app state; every editor/list/version view and every API call is parameterized by it. No screen shows two libraries at once.

**Stays global (not library-bound):** user management, the registry, auth.

### 4.2 Producer storage layout & per-library publish

**S3 layout — keyed by `code`:**

```
  BEFORE (flat)                    AFTER (per-library)
  data/mapping.csv           →     data/<code>/mapping.csv
  maps/floor_{n}.svg         →     maps/<code>/floor_{n}.svg
  versions/data/…            →     versions/<code>/data/…
  versions/maps/…            →     versions/<code>/maps/…
  staging/data/mapping.csv   →     staging/<code>/data/mapping.csv
  staging/maps/floor_{n}.svg →     staging/<code>/maps/floor_{n}.svg
```

These live per-library files **are** what the consumer fetches (§4.3) — no separate published copy.

**One helper builds every S3 key** (collapses the ~8 Lambdas' hardcoded path literals):

```js
// shared/paths.mjs
liveCsv(code)           → `data/${code}/mapping.csv`
liveSvg(code, floor)    → `maps/${code}/floor_${floor}.svg`
stagingCsv(code)        → `staging/${code}/data/mapping.csv`
stagingSvg(code, floor) → `staging/${code}/maps/floor_${floor}.svg`
versionPrefix(code)     → `versions/${code}/`
invalidation(code)      → [`/data/${code}/*`, `/maps/${code}/*`]
```

**Both existing publish paths become library-scoped, with independent blast radius:**

- **`putCsv?library=<code>`** (quick CSV edit → live): snapshot current `<code>` CSV → `versions/<code>/data/…`; validate new rows against `<code>`'s live SVGs using `<code>`'s registry floors; write `data/<code>/mapping.csv`; invalidate only `/data/<code>/mapping.csv`.
- **`promoteStaging?library=<code>`** (atomic bundle → live): validate `<code>`'s staged bundle (staged SVGs + staged CSV) **together**; promote to `maps/<code>/…` + `data/<code>/mapping.csv`; version overwritten prod files under `versions/<code>/…`; invalidate only `/maps/<code>/*` + `/data/<code>/mapping.csv`.

A Neiman publish touches only Neiman's keys and cache paths; Sourasky is never touched.

**Versioning/pruning become per-library for free:** versions land under `versions/<code>/`, so the existing `MAX_VERSIONS = 20` per-prefix prune becomes 20 per library; `listVersionsCsv/Svg`, `getVersion`, `restoreVersion` take a `libraryCode` and only read/write that library's files.

**Validation uses registry floors, not `{0,1,2}`:** `fetch-floor-svgs.mjs`, the `for (floor of [0,1,2])` loops in `promoteStaging`/`validateStaging`, and `range-validation`'s `VALID_FLOORS` take the library's `floors` from the registry. A row on a floor the library doesn't have → `invalid-floor`. The old "two buildings share floor 1 → conflated shelves" risk is structurally gone (files are physically separate). `compareDeweyNumbers` is untouched.

**Fail closed:** the validation gate runs before any live write (already true); on failure, reject the save/promote and leave the current live file intact — a bad edit never reaches patrons. Missing/unknown `libraryCode` → 400; out-of-scope → 403.

### 4.3 Consumer multi-fetch, partial-failure, offline fallback

Change is confined to the data-loading layer; gating, dialog, and SVG-highlighting are untouched.

**`LibraryConfig` learns where its data lives** (new `code`; per-library paths):

```ts
{ code: 'neiman',
  nameHe: 'הספרייה למדעים מדויקים ולהנדסה ע"ש ניימן',
  name: 'The Neiman Library of Exact Sciences and Engineering',
  svgPath: getFloorMapUrl('neiman', 1),  // …/maps/neiman/floor_1.svg
  csvUrl:  getCsvUrl('neiman'),           // …/data/neiman/mapping.csv
  locations: [ /* exact DOM strings, as today */ ] }
```

`data-source.config.ts`: `getFloorMapUrl(code, floor)` → `` `${base}/maps/${code}/floor_${floor}.svg` `` and new `getCsvUrl(code)`. The dialog's floor-swap regex (`floor_\d+\.svg$`) still works — it only rewrites the trailing number, leaving `/<code>/` intact.

**`loadMappings()` becomes a parallel multi-fetch:**
1. Read the configured libraries' `csvUrl`s from `LIBRARY_CONFIG`.
2. Fetch **in parallel** (`forkJoin`), each via the existing `fetchTextWithFallback` (CDN → bundled copy). Parallel is non-negotiable (wall-clock ≈ slower of the two, once per session).
3. Parse each; **concatenate rows** into `cachedMappings`; `buildMappingIndex` unchanged (already keys each row by its own `libraryName`, so no collision).
4. Cache merged result 5 minutes, as today.

**Partial failure = per-library graceful degradation.** Each library's fetch gets its own `catchError` returning empty instead of failing the whole load: Neiman unreachable (CDN *and* bundle) → Neiman rows absent → **Neiman buttons hidden, Sourasky keeps working.** (Replaces today's "one failure hides all buttons.") The single gated `dwarn` on CDN→bundle fallback is preserved per library. *Hardening:* index only rows whose `libraryName` matches the source file, so a mislabeled row can't leak across libraries.

**Offline fallback + bundle + sync go per-library:**
- `map-asset-fallback.ts` — `cdnAssetToLocalPath` recognizes `/data/<code>/mapping.csv` → `assets/cenlib-map/<code>/mapping.txt` and `/maps/<code>/floor_N.svg` → `assets/cenlib-map/<code>/floor_N.svg`.
- Bundled assets move into per-library subdirs mirroring the CDN: `src/assets/cenlib-map/sourasky/{mapping.txt, floor_0/1/2.svg}`, `src/assets/cenlib-map/neiman/{mapping.txt, floor_1/2.svg}`.
- `scripts/sync-map-assets.mjs` loops over libraries and their floors (kept in step with the registry) instead of hardcoded `FLOORS=[0,1,2]`, writing into per-library subdirs.

### 4.4 Migrating live Sourasky into the per-library layout

**The bundled fallback removes the hard-outage risk.** Each deployed consumer package carries a bundled copy of exactly the CDN paths it fetches (the *currently-live* package fetches flat paths and bundles flat copies; the *new* package fetches per-library paths and bundles per-library copies). So if a CDN path 404s, the live add-on falls back to its own bundled copy and the button still renders (from possibly-stale data). **The migration's worst case is therefore graceful degradation to stale bundled data, not a broken button.** The freeze/overlap sequence below exists only to avoid *staleness*, not to prevent an outage.

**Principle:** copy, don't move; keep flat paths until the new consumer is live and soaked; retire flat last.

**Cutover (one maintenance window, Sourasky editing frozen):**
1. **Freeze Sourasky editing** so nothing diverges mid-cutover.
2. **Copy** (idempotent, non-destructive script): `data/mapping.csv` → `data/sourasky/mapping.csv`; `maps/floor_{0,1,2}.svg` → `maps/sourasky/floor_{0,1,2}.svg`; `versions/data/…` → `versions/sourasky/data/…`; `versions/maps/…` → `versions/sourasky/maps/…`. Flat paths remain, still current.
3. **Deploy the new producer** (Lambdas + registry + admin). It now writes `data/sourasky/…`. The old consumer still reads the flat files — present and (editing frozen) identical. No break.
4. **Build + upload the new consumer package** to NDE (`VIEW_ID=NDE`). It reads `data/sourasky/…` (populated in step 2) + its per-library bundled fallback.
5. **Verify live** (two-tier, per release discipline): a known Sourasky record shows the button and highlights; an edit through the new admin writes `data/sourasky/mapping.csv` and appears after cache expiry.
6. **Unfreeze editing.**
7. **Soak, then retire:** after a soak (~1 week) with both layouts healthy, run `retire-flat` to delete the flat `data/mapping.csv` and `maps/floor_N.svg` (the only destructive step; last and reversible-until-run).

**Neiman is greenfield** — nothing to migrate. Onboarded via the normal add-a-library flow (author CSV + 2 floor SVGs into `data/neiman/…`, `maps/neiman/…`; add its `LibraryConfig` + bundled fallback; deploy), decoupled from and after the Sourasky migration.

**Rollback:** before step 7, redeploy the old consumer package (flat files still present) and, if needed, the old producer. The preserved flat paths are the safety net — deletion is last. *(Staging needs no migration; the new flow just starts using `staging/<code>/…`.)*

**Scripts:** `migrate-sourasky.mjs` (copy; `--dry-run` lists intended copies) and `retire-flat.mjs` (post-soak deletion).

---

## 5. Cross-cutting invariants

- **Call-number ordering parity (issue #100):** the consumer's `compareDeweyNumbers`/`isInDeweyRange` stay behaviorally identical to the producer's `compareCallNumbers`/`isCallNumberInRange`. Unchanged by this work; parity fixtures/tests (producer `WORKFLOW.md` HR1–HR4) must not be weakened.
- **Fail-closed validation** before any live write, per library, using registry floors.
- **Server-side scope enforcement** on every library-bound endpoint; UI scoping is convenience only.
- **`svgCode` ↔ SVG element id exact match** (issue #13) unchanged.

## 6. Testing strategy

**Producer**
- `checkLibraryScope` units: in-scope, out-of-scope, `*`, empty, unknown code.
- Registry sanity: unique codes, non-empty floors, required names.
- Path-helper units: each resource → correct key per code.
- Scope isolation per endpoint: an operator scoped to `neiman` gets 403 for `sourasky`.
- Write isolation: a Neiman `putCsv`/`promote` touches only `data/neiman/*` / `maps/neiman/*` (mocked-S3 key assertions); Sourasky's version list unchanged.
- Registry-floor validation: a Neiman row on a foreign floor → `invalid-floor`.
- Existing parity + bundle-validation tests stay green.

**Consumer**
- Merge: a mocked two-library fetch makes rows from both findable in one index.
- Partial failure: Neiman CSV 500 + bundle 404 → Sourasky lookups succeed, Neiman lookups return "no mapping", no throw.
- Parallel (structural): load uses `forkJoin`.
- `cdnAssetToLocalPath` maps per-library data + SVG URLs to per-library bundled paths.
- Existing button/dialog/SVG specs stay green (per-library `svgPath` floor-swap).

## 7. Rollout sequencing

1. Producer: registry + `paths.mjs` + auth scope + namespaced Lambdas + registry-floor validation (behind existing single library — Sourasky still `data/sourasky` after migration).
2. Producer admin: active-library selector + user library scoping.
3. Consumer: multi-fetch + partial-failure + per-library fallback/bundle/sync.
4. **Sourasky migration cutover** (§4.4).
5. Neiman onboarding (data authoring + config + deploy) — decoupled, after (4).

## 8. Affected files (indicative)

**Producer (`primo_maps`)**
- New: `shared/libraries.mjs`, `shared/paths.mjs`, `scripts/migrate-sourasky.mjs`, `scripts/retire-flat.mjs`.
- Auth: `role-auth.mjs` (`checkLibraryScope`), `auth-middleware.mjs` (read `custom:libraries`).
- Lambdas (add `libraryCode` + scope check + namespaced paths): `getCsv`, `putCsv`, `uploadSvg`, `uploadStagingSvg`, `listSvg`, `deleteSvg`, `validateStaging`, `promoteStaging`, `getStagingStatus`, `listVersionsCsv`, `listVersionsSvg`, `getVersion`, `restoreVersion`, `applyReconcileToStaging`.
- Validation: `shared/fetch-floor-svgs.mjs`, `shared/validateBundle.mjs`, `range-validation.mjs` (registry floors).
- Admin: `app.js` (active-library state + switcher), `edit-location-dialog.js` (drop `SINGLE_LIBRARY`; use registry), `location-row.js` (defaults from active library), `services/data-model.js` (`FLOOR_VALUES` from registry), `csv-editor.js` / `map-editor*` / `svg-manager*` (scope by active library), `create-user-dialog.js` / `edit-user-dialog.js` / `user-management.js` (library multi-select), `version-history/diff/preview` (scoped).
- Tests + parity fixtures.

**Consumer (`TAU_customModule`)**
- `src/app/custom1-module/cenlib-map/config/library.config.ts` (`code`, `csvUrl`, per-library `svgPath`, Neiman entry).
- `.../config/data-source.config.ts` (`getFloorMapUrl(code, floor)`, `getCsvUrl(code)`).
- `.../services/shelf-mapping.service.ts` (parallel multi-fetch, partial failure, merge).
- `.../services/map-asset-fallback.ts` (per-library path mapping).
- `src/assets/cenlib-map/<code>/…` (bundled per-library fallback).
- `scripts/sync-map-assets.mjs` (loop libraries + floors).
- Specs mirroring the above.

## 9. Open items to confirm

- **Neiman floor numbers** (`[1,2]` vs `[0,1]`) — needed for the registry and the SVG/CSV authoring.
- **Neiman's exact DOM strings** — the library title (`.getit-library-title`) and each collection sub-location (`[data-qa="location-sub-location"]`) as they render in NDE, captured live (they are the consumer's lookup keys).
- **Neiman map/data authoring** — the floor-plan SVGs (stable `id` per shelf) and the shelf-range CSV rows. Separate effort; the long pole.
