# CSP Readiness Report: TAU NDE Customization

## Executive Summary

This report evaluates the "TAU_customModule" NDE customization package against Content Security Policy (CSP) enforcement. 

**Current Status:**
- The customization is largely self-contained and compliant with basic CSP directives (`object-src`, `worker-src`).
- **CRITICAL FINDING**: The **Shelf Map** feature (`ShelfMappingService`) relies on fetching data from **Google Sheets** (`docs.google.com`). This will **FAIL** if `connect-src` is enforced without adding this domain to the allowed list.
- Most other external references are simple navigation links (`<a href>`) which are not restricted by standard CSP.

**Immediate Risk Level:** LOW (assuming no `connect-src` enforcement yet).
**Future Risk Level:** HIGH (Shelf Map will break when `connect-src` is enabled).

---

## 1. External Domains Inventory

The following table lists all external domains identified in the codebase and their resource types.

| Domain | Resource Type | Usage Location | HTTPS? | Required? | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `docs.google.com` | **API (Fetch/XHR)** | `src/app/custom1-module/cenlib-map/config/google-sheets.config.ts` <br> Used by `ShelfMappingService` to fetch CSV data. | Yes | **YES** | **High** (Blocked by `connect-src`) |
| `english.tau.ac.il` | Navigation Link | `footer_en.html`, `footer_he.html` | Yes | Optional | Low (Navigation only) |
| `libraries.tau.ac.il` | Navigation Link | `homepage_he.html` (Opening hours) | Yes | Optional | Low (Navigation only) |
| `en-libraries.tau.ac.il` | Navigation Link | `homepage_en.html` (Opening hours) | Yes | Optional | Low (Navigation only) |
| `uli.nli.org.il` | Navigation Link | `external-sources.config.ts` (Search assist) | Yes | Optional | Low (Navigation only) |
| `www.worldcat.org` | Navigation Link | `external-sources.config.ts` (Search assist) | Yes | Optional | Low (Navigation only) |
| `scholar.google.com` | Navigation Link | `external-sources.config.ts` (Search assist) | Yes | Optional | Low (Navigation only) |
| `search.crossref.org` | Navigation Link | `external-sources.config.ts` (Commented out) | Yes | Optional | Low (Navigation only) |

---

## 2. Evaluation Against CSP Directives

### Current Enforcement (January Release)

*   **`object-src`**: ✅ **PASS**. No `<object>`, `<embed>`, or `<applet>` tags were found.
*   **`worker-src`**: ✅ **PASS**. No `Worker`, `SharedWorker`, or `ServiceWorker` usage found.
*   **`upgrade-insecure-requests`**: ✅ **PASS**. All identified external URLs use `https://`.

### Future-Proofing (Potential Strict Directives)

*   **`connect-src`**: ⚠️ **AT RISK**.
    *   **Finding**: `ShelfMappingService` performs an HTTP GET to `https://docs.google.com/...`.
    *   **Impact**: If `connect-src` is set to `'self'` (or Alma defaults) without exception, the Shelf Map feature will fail to load mappings. Console will show `Content Security Policy: The page’s settings blocked the loading of a resource at https://docs.google.com/...`.
    *   **Fix**: Must add `https://docs.google.com` to the Allowed-List.

*   **`img-src`, `script-src`, `style-src`**: ✅ **PASS**.
    *   `ASSET_BASE_URL` is set to `/nde/custom/972TAU_INST-NDE_TEST` (relative path).
    *   Images in `src/assets` and styles in `src/app/styles` are served from the same origin.
    *   No external fonts (Google Fonts) or CDNs are currently used in the inspected files.

*   **`frame-src` / `child-src`**: ✅ **PASS**. No `<iframe` usage found pointing to external domains.

---

## 3. Recommendations

### Priority 1: Critical (Must Do)

1.  **Add `docs.google.com` to Allowed-List Additions**
    *   **Why**: To allow `ShelfMappingService` to fetch the shelf mapping CSV.
    *   **Action**: In Alma Configuration > Discovery > Other > Security > Allowed-List Additions, add:
        *   **Type**: `connect-src` (or general/default if specific not available)
        *   **Value**: `https://docs.google.com`

### Priority 2: Hardening & Refactoring (Best Practice)

1.  **Consider Self-Hosting Shelf Mappings (Optional but Recommended)**
    *   **Context**: Relying on Google Sheets as a backend DB creates a dependency on an external domain.
    *   **Recommendation**: Download the CSV and bundle it with the customization package in `src/assets/maps/shelf-map.csv` if the data does not change frequently.
    *   **Benefit**: Removes the need for `connect-src https://docs.google.com`, making the policy tighter.
    *   **Code Change**: Update `GOOGLE_SHEETS_CONFIG` to point to a local asset URL.

2.  **Verify `ASSET_BASE_URL` in Production**
    *   **Context**: The current `build-settings.env` uses a relative path.
    *   **Action**: Ensure that in the production deployment pipeline, this variable remains a relative path. If it ever changes to a CDN (e.g., `https://cdn.university.edu`), that CDN domain must be added to `script-src`, `style-src`, and `img-src`.

3.  **Monitor "External Search" Features**
    *   **Context**: `FilterAssistPanel` creates links.
    *   **Action**: If these features are ever converted to open in a modal (iframe) or fetch results dynamically (API), the respective domains (`uli.nli.org.il`, etc.) must be added to the Allowed-List immediately.

---

## 4. Suggested Allowed-List Additions

If you must keep the Google Sheets integration:

| Directive | Domain | Note |
| :--- | :--- | :--- |
| `connect-src` | `https://docs.google.com` | Required for Shelf Mapping CSV fetch. |

*Note: Navigation links (anchors) do not require CSP allow-listing.*
