# Per-view assets

Everything Primo fetches from the package by a **fixed URL** — the stylesheet, the extra script,
the footer and homepage HTML — lives here, one subdirectory per **view family**.

```
src/assets/views/
  nde/    → VIEW_ID=NDE (live for patrons) and VIEW_ID=NDE_TEST
  tma/    → VIEW_ID=TMA_NDE and, after cutover, VIEW_ID=TMA
```

**Edit the file under `views/<family>/`. Never the copy at the fixed path.**

`scripts/select-view.mjs` runs on every `npm run build` and `npm run start:proxy`. It reads
`VIEW_ID` from `build-settings.env`, looks the family up in its table, deletes every fixed path
any family can occupy, and copies the selected family's files over them:

| Source | Generated copy Primo fetches |
|---|---|
| `views/<family>/css/custom.css` | `src/assets/css/custom.css` |
| `views/<family>/js/custom.js` | `src/assets/js/custom.js` |
| `views/<family>/header-footer/footer_en.html` | `src/assets/header-footer/footer_en.html` |
| `views/<family>/header-footer/footer_he.html` | `src/assets/header-footer/footer_he.html` |
| `views/<family>/homepage/homepage_en.html` | `src/assets/homepage/homepage_en.html` |
| `views/<family>/homepage/homepage_he.html` | `src/assets/homepage/homepage_he.html` |

The generated copies are **gitignored and left read-only**, which is what should stop you editing
one by mistake: your editor will object, and an edit that got through would be silently discarded
by the next build. The deletion step matters as much as the copy — without it, a TMA build that
provides no footer would ship the NDE footer left behind by the previous build, which is exactly
the failure this layout exists to prevent.

## Adding a file

1. Put it under `views/<family>/` at the path Primo will fetch it from, relative to `assets/`.
2. Add the generated destination (`src/assets/<that path>`) to `.gitignore`.

`select-view.mjs` refuses to run until step 2 is done: an untracked generated file makes
`postbuild.js` stamp every package `-dirty`, and a `-dirty` package must not be uploaded.

## Not per-view

- `src/assets/css/custom.js` — a 174-byte placeholder from the Ex Libris template. Leave it.
- `src/assets/images/`, `src/assets/icons/`, `src/assets/cenlib-map/` — shared by every view.
- `src/assets/homepage/homepage.css.tmpl` — a template, not a fetched file.

## Components

Components are selected the same way but by a different mechanism, because they are *compiled*
rather than copied: see `src/app/views/<family>/component-map.ts`. Design and reasoning:
`docs/superpowers/specs/2026-09-09-per-view-isolation-design.md`.
