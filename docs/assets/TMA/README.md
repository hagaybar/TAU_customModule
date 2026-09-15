# TMA design sources

Nothing in this folder ships. It is where the artwork the TMA package is *built from* lives,
so that every image under `src/assets/views/tma/images/` can be regenerated instead of being
an un-editable binary someone has to recreate by hand.

## Supplied by Hila (2026-09-09)

| File | What it is | Ships as |
|---|---|---|
| `tma-pat-logo.png` | The wordmark, white-on-transparent, 300×73 | see *Logo* below |
| `Yellow.jpg` | Trademark tile grid, warm colourway, 1157×609 | `images/tma-trademarks-grid.jpg` (q82, 179 KB → 115 KB) |
| `Blue.jpg` | The same grid in a cool colourway | **not shipped** — the alternative, kept in case the palette changes |
| `PATENT-HP-FULL.jpg` | Patent drawings, 1840×610 | `images/tma-search-background.jpg` (q78, 979 KB → 207 KB) |

## Taken from the classic Primo VE view

| File | Source | Ships as |
|---|---|---|
| `PATENT.png` | `/discovery/custom/972TAU_INST-TMA/img/PATENT.png` | `images/tma-patents.jpg` (flattened onto white, q82, 934 KB → 131 KB) |
| `classic-logo-reference.png` | `/discovery/custom/thumbnails/thumbnail_972TAU_INST-TMA.png` | never — reference only |

## Logo

The classic logo frames its wordmark with two corner marks, top-right and bottom-left, so it
reads as a stamp rather than a line of type. Hila's redesign changed the typeface and dropped
them. `make-logo.py` keeps her typography and puts the corners back in the classic's
proportions — measured off `classic-logo-reference.png` and expressed as fractions of the
canvas, so they survive a resize.

```bash
python3 docs/assets/TMA/make-logo.py
```

It writes three files and prints what it wrote:

- `src/assets/views/tma/images/library-logo.png` — black ink, for the current white header
- `src/assets/views/tma/images/library-logo-he.png` — the same file; this view is
  English-only, and the host asks for a per-language logo regardless
- `docs/assets/TMA/tma-pat-logo-stamp-white.png` — white ink, kept here for whenever the
  header is dark again. Hila's artwork is white because it was drawn for a dark bar.

The recolour replaces the RGB channels and leaves alpha untouched rather than inverting;
inverting would flip the anti-aliased edge pixels' coverage as well as their colour and
fringe the strokes.

## Regenerating the photographic images

The JPEG conversions above were one-off Pillow calls at the stated quality settings. If a
source is replaced, re-run the same conversion rather than dropping the raw file into
`src/` — `PATENT-HP-FULL.jpg` alone is 979 KB, and the package ships on every page load.
