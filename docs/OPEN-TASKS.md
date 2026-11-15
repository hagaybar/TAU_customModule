# Open tasks

Last updated: 2026-11-15

## PRs
- #121 (Shelf Map: one shared mapping.csv fetch between buttons, closes #118) — merge; then build and upload the NDE package (changes the live package)
- #120 (remove the deprecated sync-fork workflow, closes #116) — merge; no package change
- #26 (second-library Shelf Map assessment dashboard, draft) — parked with #27 until the user calls for it

## Issues
- #110 (Shelf Map missing buttons reported 11.11.26) — 4 of 7 fixed and verified live; cases 1, 4, 7 (B1 copies mapped only in B2), cabinet 52A `792.75` typo and Simchoni `355.1` gap wait on staff; not urgent, recheck on report
- #117 (Shelf Map: notice when the button disappears for everyone) — user picks Mixpanel zero-opens alert (recommended) or scheduled CDN check
- #29 (lighter results-toolbar accent colour, from the library's 30.07.26 NDE request doc) — waiting on staff for a colour value; must stay WCAG AA with the pill chip
- #75 (Primo NDE Angular 20 upgrade, Feb 2027) — rebuild and validate when Ex Libris ships the template
- #38 (Shelf Map: read location from host store, not DOM) — implementation; can start alone
- #14 (call-number handling tied to Central Library conventions) — research; needed before a second library
- #47 (let Alma Sandbox origin fetch Shelf Map data from CloudFront) — CORS change is infrastructure; needs the user
- #27 (onboard Neiman library to Shelf Map) — on hold until the user calls for it

## Other
- NDE_MAPS_MANGER#205 (reject floor-plan SVGs with script content at upload) — open in that repo; say when to build it
- #110 case 7 side note: the Shelf Map button shows even when every copy is on loan — product decision for staff, not filed
- `investigation/nde-practical-test` remote branch (3 commits of 5 Nov) — fully merged into main; delete with the user's OK
