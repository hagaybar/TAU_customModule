# CenLib Shelf Map (Sourasky Central Library)

**Status:** ✅ Production (integrated into `main` via [PR #16](https://github.com/hagaybar/TAU_customModule/pull/16); bootstrap fix in [PR #17](https://github.com/hagaybar/TAU_customModule/pull/17))
**Code:** `src/app/custom1-module/cenlib-map/`
**Mount point:** `nde-location-top` → `CenlibMapButtonComponent`

---

## Overview

The **CenLib Shelf Map** feature adds an interactive **"Shelf Map"** button to each holding
location in a Primo NDE full-record display. When a patron clicks it, a modal dialog opens
showing exactly where the item sits on the shelf: its library, collection, call-number
section, floor, shelf label, and a **highlighted floor-plan SVG** with the target shelf(es)
called out.

It is currently configured for the **Sourasky Central Library** (`הספרייה המרכזית סוראסקי`)
and its reading rooms and special collections, but the architecture is **multi-library /
multi-location** (referred to in the code as *MDM — Multi-Dimensional Mapping*) and can be
extended to other libraries by adding configuration + data.

The button **replaces the native ExLibris "Locate" button** at each location where a mapping
exists, and falls back to the native button everywhere else.

---

## What the patron sees

1. On a full-record page, each physical location normally shows a native **"Locate"** button.
2. Where TAU has shelf-map data for that *library + collection + call number*, the custom
   module hides "Locate" and shows a **"Shelf Map"** button instead
   (Hebrew UI: **"מפת מדף"**).
3. Clicking it opens the **Shelf Location Map** dialog (Hebrew: **"מפת מיקום המדף"**) which shows:
   - Library and collection (in the current UI language),
   - Call number (raw, as displayed in Primo),
   - Section description, floor, shelf label, and librarian notes,
   - A **floor-plan SVG** with the matching shelf element(s) highlighted.
4. When a call number matches **more than one** shelf (overlapping ranges), the dialog lists
   all candidate shelves ("The item should be in one of these shelves: …").

The UI is **bilingual (English / Hebrew)**; language is detected from the `lang` URL parameter.

---

## Architecture

```
nde-location-top  ─mounts→  CenlibMapButtonComponent   (tau-cenlib-map-button)
                                     │  reads DOM: library title, sub-location, call number
                                     │  asks ShelfMappingService "is there a mapping?"
                                     ▼
                            CenlibMapDialogComponent    (tau-cenlib-map-dialog)
                                     │  resolves all matching mappings + primary floor
                                     ▼
                            ShelfMapSvgComponent         (renders + highlights the SVG)

ShelfMappingService  ──HTTP──►  AWS CloudFront CDN
                                  • /data/mapping.csv       (shelf-mapping table)
                                  • /maps/floor_{n}.svg     (floor-plan drawings)
```

### Components

| File | Role |
|------|------|
| `cenlib-map-button.component.ts` | Location-level button. Extracts DOM data, checks for a mapping, hides/restores the native "Locate" button, opens the dialog. |
| `cenlib-map-dialog/cenlib-map-dialog.component.ts` | Modal dialog. Resolves all matching mappings, scopes them to a single floor, and drives the SVG view. |
| `shelf-map-svg/shelf-map-svg.component.ts` | Loads the floor-plan SVG and highlights the matched `svgCode` element(s). |
| `services/shelf-mapping.service.ts` | Loads/caches the CSV from the CDN, builds a fast lookup index, and performs Dewey call-number range matching. |

### Configuration files (`cenlib-map/config/`)

| File | What it holds |
|------|---------------|
| `library.config.ts` | Whitelist of supported libraries and their locations. `nameHe` **must match the Primo NDE DOM text exactly** — it is the lookup key. |
| `shelf-mapping.config.ts` | The `ShelfMapping` interface (CSV schema) plus legacy/fallback data. Production data comes from the CDN CSV. |
| `data-source.config.ts` | AWS CloudFront base URL, CSV URL, floor-SVG URL builder, and cache duration (5 min). |

---

## Data model (MDM)

A shelf lookup is keyed on three dimensions:

```
library name  +  collection / sub-location name  +  call-number range  →  svgCode (+ metadata)
```

The shelf-mapping table (CSV on the CDN) has these columns:

| Column | Meaning |
|--------|---------|
| `libraryName` / `libraryNameHe` | Library display name (EN / HE) — must match Primo DOM |
| `collectionName` / `collectionNameHe` | Collection / sub-location name (EN / HE) — must match Primo DOM |
| `rangeStart`, `rangeEnd` | Inclusive call-number range (strings, e.g. `892.4`) |
| `svgCode` | ID of the shelf element to highlight in the floor SVG |
| `description` / `descriptionHe` | Human-readable section label |
| `floor` | Floor the shelf is on (selects which `floor_{n}.svg` to show) |
| `shelfLabel` / `shelfLabelHe` | Physical shelf label |
| `notes` / `notesHe` | Optional librarian notes |

The service indexes every mapping under **both** its English and Hebrew library/collection
names, so lookups work regardless of the UI language.

### Call-number matching

Call numbers are matched with a **canonical Dewey string comparison** that is kept
behaviourally identical to the Primo Maps **producer** repo (`NDE_MAPS_MANGER`, issue #100),
so the consumer's in-range decision matches the producer's exactly:

- The **cutter** is stripped from the DOM call number (`892.413 מאו` → `892.413`).
- The leading integer (main class) is **zero-padded to 3 digits** so magnitude sorts
  correctly under string comparison (`99.5` → `099.5`).
- `(` sorts before `.` so a parenthetical sub-classification sorts right after its base.
- **Exception:** the `ML` / `MT` prefixes are compared by the *natural* number after the
  prefix (`ML5 < ML113`), not by zero-padded string.

See `compareDeweyNumbers()` / `isInDeweyRange()` in `shelf-mapping.service.ts` for the
authoritative implementation.

---

## Data source (AWS CloudFront CDN)

Both the mapping data and the floor drawings are served from CloudFront (CORS is configured
for `tau.primo.exlibrisgroup.com` and `localhost`):

- **CSV:** `https://d3h8i7y9p8lyw7.cloudfront.net/data/mapping.csv`
- **SVGs:** `https://d3h8i7y9p8lyw7.cloudfront.net/maps/floor_{n}.svg` (floors 0, 1, 2)

The service caches the parsed CSV for **5 minutes**. On any fetch/parse error it caches an
empty result, so the button simply stays hidden (fail-safe — no broken UI).

> **Note:** the SVG files under `src/assets/cenlib-map/` and
> `docs/features/map_cenlib_shelves/` (`Floor_0.svg`, `Floor_1.SVG`, `Floor_2.SVG`, plus the
> Dewey spreadsheet) are the **authoring/source copies**. At runtime the app loads the
> published copies from the CDN.

---

## Button visibility & lifecycle

The button renders **only** when all three checks pass:

1. The library name from the DOM (`.getit-library-title`) is present in `LIBRARY_CONFIG`.
2. The collection name (`[data-qa="location-sub-location"]`) is a configured location of that
   library.
3. The CDN mapping data contains at least one row matching *library + collection + call
   number* (`ShelfMappingService.hasMappingAsync`).

Because NDE creates several component instances for the same location, ownership of a
location's "shelf-map slot" is recorded on the `<nde-location>` element via the
`data-tau-shelf-map-owner` attribute. Only the owning instance shows the button and hides the
native "Locate" button; extra instances render nothing. On destroy, the native "Locate"
button is restored **only** if no other shelf-map button remains — this prevents the failure
mode where a location was left with "Locate" hidden and no "Shelf Map" button in its place.

### Floor scoping (issue #12)

A single Dewey call-number range must never span floors. If a lookup returns matches on more
than one floor, that indicates a **data error** in the CSV. The dialog keeps only the primary
(first-match) floor, drops the off-floor matches, and logs a loud `console.error` so library
staff can fix the mapping data — rather than silently handing off-floor codes to a floor SVG
that can never highlight them.

---

## Runtime dependency (issue / PR #17)

The service uses Angular's `HttpClient` to fetch the CSV. `HttpClientModule` is provided in
the application bootstrap (`src/app/app.module.ts`). Without it the button never mounts
(dependency-injection failure), which is exactly the bug fixed in **PR #17**.

---

## Extending to another library / collection

1. Find the **exact** Hebrew library name as shown in the Primo DOM (`.getit-library-title`)
   and the exact collection name (`[data-qa="location-sub-location"]`).
2. Add a `LibraryConfig` entry (with matching `nameHe`) and its `locations` to
   `library.config.ts`.
3. Draw the floor-plan SVG(s), give each shelf a stable element `id` (= `svgCode`), and
   upload them to the CDN `/maps/` path.
4. Add the shelf-mapping rows (library, collection, ranges, `svgCode`, floor, labels) to the
   CDN CSV.
5. Validate that every `svgCode` in the CSV exists as an element ID in the SVG (see the
   validation report below).

---

## Validation

- **[validation/mismatch-report.md](validation/mismatch-report.md)** — cross-checks each
  `svgCode` in the CSV against the element IDs present in the corresponding floor SVG and
  flags mismatches (e.g. `cl1_*` in the CSV vs. `cl_*` in the SVG).

---

## Companion repository: Primo Maps (`NDE_MAPS_MANGER`)

The shelf-map feature is one half of a **producer / consumer** pair. This custom module is the
**consumer** — it downloads a published data bundle and renders it. The data itself is
**produced and maintained in a separate companion repository, `NDE_MAPS_MANGER`** (the
"Primo Maps" manager), which is developed and versioned independently of this repo.

### Who does what

| | **Primo Maps** (`NDE_MAPS_MANGER`) — producer | **This repo** (custom module) — consumer |
|---|---|---|
| **Role** | Authoring, validation, and publishing of the map data | Downloading and rendering the data in NDE |
| **Owns** | The shelf-mapping CSV and the floor-plan SVG bundle | The location button, dialog, and SVG-highlighting components |
| **Tooling** | Librarian-facing admin UI + a validation AWS Lambda | Angular components + `ShelfMappingService` |
| **Publishes to** | AWS CloudFront CDN (`/data/mapping.csv`, `/maps/floor_{n}.svg`) | — (reads from that CDN at runtime) |
| **Does *not*** | Touch the NDE UI | Author or mutate the map data |

### The shared contract

Because the two repos are decoupled but must agree exactly, a few invariants are kept in
lock-step. Any change to these on the producer side must be mirrored here (and vice-versa):

1. **Call-number ordering.** The consumer's `compareDeweyNumbers()` /
   `isInDeweyRange()` (in `shelf-mapping.service.ts`) are kept behaviourally identical to the
   producer's `compareCallNumbers` / `isCallNumberInRange`
   (`lambda/range-validation.mjs`, `admin/utils/range-filter.js`,
   `admin/services/data-model.js`). Parity is protected by the consumer's spec
   (`shelf-mapping.service.spec.ts`), which mirrors the producer's own test suites
   (`admin/__tests__/call-number-ordering.test.js`,
   `lambda/__tests__/range-validation-compare.test.mjs`). Origin: **issue #100**.
   *TAU addition over the producer:* DOM call numbers may not arrive 3-digit padded, so the
   consumer canonicalizes a short leading integer before comparing.
2. **`svgCode` ↔ SVG element id (exact match).** Every `svgCode` in the CSV must exist as an
   element `id` in the matching floor SVG. The producer enforces this at publish time
   (`validateBundle.mjs`: `set.has(svgCode)`); the consumer matches **exact ids only** (no
   fuzzy fallback) so producer↔consumer drift surfaces as a visible "Shelf(s) not found"
   warning instead of silently highlighting the wrong shelf. See issue #13.
3. **CSV schema.** The column set the consumer parses (see [Data model](#data-model-mdm)) is
   the shape the producer emits.

> **Note on the name:** `NDE_MAPS_MANGER` is the repository's actual identifier (the "manager"
> spelling in the code/history). It is referred to as "Primo Maps" in conversation.

---

## Related

- `docs/features/map_cenlib_shelves/Shelf No._Dewey.xlsx` — Dewey → shelf source spreadsheet.
- **[validation/mismatch-report.md](validation/mismatch-report.md)** — `svgCode` ↔ SVG-id
  cross-check (the consumer-side view of invariant #2 above).
- Companion repo **`NDE_MAPS_MANGER`** (Primo Maps, issue #100) — produces the CSV/SVG bundle
  and owns the call-number comparison rules this feature mirrors.
</content>
</invoke>
