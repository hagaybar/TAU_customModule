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

The Mixpanel **project token** (never the API secret) comes from the build process's
`TAU_MIXPANEL_TOKEN` environment variable. Configure it through the existing authorized
build environment; do not put it in tracked files or logs.

`scripts/write-tracking-token.mjs` writes `src/app/state/tracking.generated.ts`
(gitignored). Generation always replaces the previous value: unset, blank, or invalid
(non-alphanumeric) input writes an empty token. It never recovers an old value.
Standalone generation, local serving, and unit tests remain usable without a token.
Diagnostics report enabled/disabled status only.

### Package-build safeguard

Ordinary `npm run build` packages for **NDE and NDE_TEST** require valid configuration.
`scripts/check-tracking-build.mjs` checks the environment before generation and the
resulting generated configuration before compilation. For enabled tracking, its token must
match the current input after the same whitespace trimming and alphanumeric validation
used by generation; a stale nonempty token is rejected without displaying either value. The postbuild lifecycle checks
that generated configuration again before packaging. A missing token is a hard failure,
not a warning buried in successful build output. Other declared view families retain
their token-optional behavior; no tracking is enabled for them by this safeguard.

For an intentionally tracking-disabled development package, use:

```bash
npm run build:check -- --tau-tracking-disabled
```

This explicit option forces an empty generated token, even if the environment contains
one. It requires the existing verification mode: packages stay under
`tau-packages/verification/<date>/`, with their own manifest, and are **not for upload**.
`build:check` alone still requires a token for NDE/NDE_TEST. The disabled option on an
ordinary build is rejected. The existing archive-root override also applies to verification.
Use the normal build workflow; direct Angular or packaging-script invocations do not
provide the npm lifecycle safeguards.

The live-browser diagnosis confirmed that the deployed NDE package reached tracking but
suppressed `Shelf Map Open` because its embedded token was empty. A build without the
variable can cause this, including overwriting earlier generated configuration. The
historical environment of that particular deployed build has not been established.

Regression coverage: `node --test scripts/__tests__/tracking-build.test.mjs` uses only
synthetic configuration and disposable fixtures; it does not compile or package the app.

## Verify

1. Build for `NDE_TEST` with the token set; upload; open a record with a Shelf Map button.
2. DevTools → Network: one POST to `api-eu.mixpanel.com/track` per dialog open; response
   `{"error":null,"status":1}`. With `?tauDebug=1` the console also logs `[Tracking] …`.
3. Mixpanel → Events: `Shelf Map Open` appears within about a minute.

Code: `src/app/services/usage-tracking.ts` (generic, reusable for other add-ons).
