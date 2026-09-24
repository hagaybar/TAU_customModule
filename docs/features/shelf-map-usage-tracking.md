# Shelf Map usage tracking (Mixpanel)

**Status:** ✅ `NDE_TEST` (verified 2026-09-24) and `NDE`. Views are listed in `TRACKING_VIEWS`.

Counts how often patrons open the Shelf Map ("מפת מדף") dialog, in **TAU's own Mixpanel
project**, separate from Primo's built-in analytics.

## What is sent

One event, `Shelf Map Open`, per dialog opened — fired after the shelf lookup settles, so the
outcome and floor are known. Sent from `CenlibMapDialogComponent.trackOpen()`.

| Property | Source |
|---|---|
| `addon`, `addon_version` | `'tau-shelf-map'`, `SHELF_MAP_ADDON_VERSION` in the dialog component |
| `Primo View` | e.g. `972TAU_INST:NDE_TEST` — same name and format as Primo's own Mixpanel events, so one "Primo View" filter covers both |
| `record_id` | `docid` from the page URL |
| `library`, `location` | English config names (so events group the same in either UI language) |
| `call_number` | as shown in Get It |
| `floor`, `shelves` | from the matched mappings (shelf label, else SVG code) |
| `ui_lang` | `he` / `en` |
| `map_found`, `outcome` | `found` · `not_found` · `error` · `missing_data` |

## Privacy

- **Nothing is stored in the patron's browser** — no cookies, no localStorage. Each event carries
  a fresh random `distinct_id`, so Mixpanel counts **opens, not people** (no "unique users").
- `ip=0`: Mixpanel does not derive location from the IP.
- No patron or request-form data. Keep it that way.
- No SDK: a single form-encoded POST to `https://api-eu.mixpanel.com/track` (EU residency).
  Tracking can never break the button — every failure is swallowed.

## The token

The Mixpanel **project token** (never the API secret) comes from the environment at build time:

```bash
export TAU_MIXPANEL_TOKEN=<project token>   # in your shell's credentials file, not in the repo
```

`prebuild.js` writes it to `src/app/state/tracking.generated.ts` (gitignored) and prints only
whether it is set. Unset → tracking is off in that build. The token does ship inside the
package — project tokens are public by design.

## Verify

1. Build for `NDE_TEST` with the token set; upload; open a record with a Shelf Map button.
2. DevTools → Network: one POST to `api-eu.mixpanel.com/track` per dialog open; response
   `{"error":null,"status":1}`. With `?tauDebug=1` the console also logs `[Tracking] …`.
3. Mixpanel → Events: `Shelf Map Open` appears within about a minute.

Code: `src/app/services/usage-tracking.ts` (generic, reusable for other add-ons).
