# Host NgRx Store probe — how to run & read it (issue #19)

A **throwaway diagnostic** that answers one question we cannot settle by reading the repo:

> When a TAU custom component asks Angular's injector for the host's `@ngrx/store` `Store`,
> does it get Primo's **populated** root state, a separate **empty** store, or **nothing at all**?

`webpack.config.js:84` shares `@ngrx/store` as a singleton — that proves the *library/token* is
shared, **not** that our injector resolves `Store` to the host's *populated* instance. Only a live
run settles it. The result decides whether **Path B** (direct `inject(Store)`, no LIBIS library, no
Angular-19 bump — see issue #19 and #6) is viable on our current Angular-18 build.

## What it is

- `src/app/custom1-module/store-probe/store-probe.util.ts` — the shared core (all logic).
- `src/app/custom1-module/store-probe/store-probe.component.ts` — two tiny standalone components,
  each rendering nothing.
- Two temporary rows in `customComponentMappings.ts`:
  - `nde-location-bottom`  → mounts on a **record's Get-It page** (where `delivery.holding[]` lives)
  - `nde-filters-group-after` → mounts on a **search-results page** (where `router`/`search` live)

Two slots only hedge slot-name risk (NDE slot names are partly empirical — see issue #4). The host
store is a **single global instance**, so whichever slot mounts, the probe reads the same store.

The probe is **fully inert unless the TAU debug flag is on** — no subscribe, no logging, no global.

## How to run (local proxy — no deploy)

1. Start the proxy build (serves our module + injects it into the live Primo host):
   ```bash
   npm run start:proxy
   ```
2. Open the proxied NDE page in the browser. In the console, enable debug and reload:
   ```js
   localStorage.setItem('tauDebug', '1');   // then reload
   ```
3. **Do a search** (mounts the `nde-filters-group-after` probe) and **open a record → Get It**
   (mounts the `nde-location-bottom` probe). Watch the console.

## How to read the result

| Console shows | Meaning |
|---|---|
| `inject(Store) is NULL` | Our injector has **no** Store provider → host store not reachable via DI. **Path B blocked.** |
| `state emitted but EMPTY ({})` | We got a **separate/local** store, not the host's populated one. Path B likely not viable. |
| `host state POPULATED — top-level slices: [...]` + `"delivery"/"router" present ✅` | **Path B is viable on Angular 18.** Green light. |

## Interactive console helpers

Once mounted with debug on, a helper is installed at `window.__tauStoreProbe`:

**Safe (structure only — no values; OK to share):**
```js
__tauStoreProbe.keys()            // top-level slice names
__tauStoreProbe.shape('delivery') // field-name shape of the delivery slice — no values
__tauStoreProbe.dumpShape()       // field-name shape of the whole state — no values
```
The key question for the DOM→store migration: does `shape('delivery')` show the `holding[]` fields
(`mainLocation` / `subLocation` / `callNumber`) that `cenlib-map-button` currently scrapes from
rendered text? And does `shape('router')` expose `queryParams` that `SearchQueryService` parses out
of the URL?

**Raw (live objects for LOCAL devtools inspection — may contain PII):**
```js
__tauStoreProbe.delivery()  __tauStoreProbe.router()  __tauStoreProbe.search()
__tauStoreProbe.slice(name)  __tauStoreProbe.state
```
> ⚠️ The store contains `user` / `account` / `session` data. These raw helpers are for **your**
> browser inspection only — **do not paste those slices back into chat.** Prefer the `shape(...)` /
> `dumpShape()` helpers when sharing findings.

## Removing the probe afterward

Delete `src/app/custom1-module/store-probe/`, remove its import + the two mapping rows in
`customComponentMappings.ts`, and delete this doc. (All probe code is marked "THROWAWAY … issue #19".)
