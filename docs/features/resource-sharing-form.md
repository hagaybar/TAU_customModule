# Resource sharing form: who controls the library box

**Finding (2026-11-01):** the library fields on the resource sharing form (`/nde/blankIll`) come
from Ex Libris and the Alma configuration. No TAU code touches this form, so change it in Alma or
raise it with Ex Libris. Do not rebuild a component for it.

## The fields

| Field key in host code | English label | Hebrew label |
|---|---|---|
| `owner` | For library | עבור ספריה |
| `pickupLocation` | Pickup location | מקום איסוף |

The host hides `owner` when the form's `groups-list-map` has only one entry. It sorts both fields
with `sortPickupOwnerOptionsIfAlphabeticalSortEnabled` when the customer parameter
`alphabetical_sort_pickup_inst_lib` is true. That parameter was true on production and sandbox for
`NDE`, `NDE_TEST`, `TMA_NDE` and `TMA`.

The sort puts the patron's campus first and personal delivery last, then orders by category and
value, so the result is not always plain A-Z.

The release notes cover `owner` only: [Primo VE 2026 release notes](https://knowledge.exlibrisgroup.com/Primo/Release_Notes/002Primo_VE/2026/010Primo_VE_2026_Release_Notes),
November 2026, URM-333424. The entry appears to be collapsed under "Resolved Issues", so a page
search may not find it until that section is expanded. No note mentions sorting `pickupLocation`;
that comes from reading the host code.

## TAU's removed component

`IllPickupLibrarySorterComponent` sorted the `owner` field. It was disabled, never shipped, and was
removed in #94 (remove the disabled ILL pickup-library sorter).

## Evidence that the form is not ours

All checked on 2026-11-01 against sandbox `972TAU_INST:NDE`
(`https://tau-psb.primo.exlibrisgroup.com`).

- **Runtime check, signed in on the form, run by the library:** the console command below returned
  `0`. No add-on element was mounted inside the form.
- **TAU package:** the served package registers four slots: `nde-filters-group-before`,
  `nde-header-before`, `nde-location-top` and `nde-search-no-results-bottom`. Its 19 scripts contain
  no form identifiers (`nde-ill-request`, `blankIll`, `almaResourceSharing`, `groups-list-map`,
  `pickupLocation`), and its CSS and `custom.js` do not target the form.
- **Other add-ons on the view:** the bundles from `d12yf4fanpvbex.cloudfront.net/01BC_INST-ndeView`
  and `discovery-adapters.thirdiron.com` register only availability and record-image slots, and
  contain no form identifiers.
- **Host code:** `nde-ill-request` is the component that renders the blank form, so the runtime check
  looks at the right element.

## Repeating the check

Sign in, open `/nde/blankIll?vid=<view>`, and run this in the browser console:

```js
[...document.querySelectorAll('nde-ill-request *')].filter(e => e.tagName.includes('FROM-REMOTE')).length
```

`0` means no add-on is mounted in the form. Confirm first that
`document.querySelector('nde-ill-request')` is not `null`, otherwise `0` proves nothing. Add-on
elements are named `<slot>-from-remote-<n>` (see `docs/features/collection-discovery-filter.md`).

## Limits

- The sandbox was running an older package than production: it has no collection discovery filter and
  matches no archived `NDE` build. The result describes that package.
- The script scan used the copy served by the sandbox, not the zip downloaded from Alma.
- Only the add-on scripts loaded on the home page were scanned. The console check covers add-ons on
  the form itself.
- The check was run on sandbox only. On production, the current TAU package (`4ab65a2`) was built
  with the sorter removed, but the console check has not been run there.
