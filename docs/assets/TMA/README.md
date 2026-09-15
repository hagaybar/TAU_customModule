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

## Loading animation

The Primo host fetches `assets/images/loadingAnimations/LoadingAnimationJson.json` and plays
it while a page loads. It is a **Lottie** file, not an SVG — the host hands that path to a
Lottie player, so an SVG there renders nothing. NDE has shipped its own since Ex Libris case
10665359; TMA was getting the stock dots only because the file used to sit at a shared path.

**Shipping now: `stamp`.** Change it with one word:

```python
# docs/assets/TMA/ship-loading-animation.py
CHOSEN = 'stamp'
```

```bash
python3 docs/assets/TMA/ship-loading-animation.py
```

Only that script writes into the package. The two generators below write into
`loading-variants/` and nothing else, so re-running either one can never quietly change what
is live.

```bash
python3 docs/assets/TMA/make-loading-animation.py   # the pen and its variants
python3 docs/assets/TMA/make-loading-concepts.py    # stamp, cogs, tiles, blots
```

### The candidates

All seven are kept — comparing them again later is cheaper than rebuilding one from a
description. They are committed as JSON in `loading-variants/`, and the
[Nib Trials](https://claude.ai/artifact/LJZzRj8k6JoZWJNCmjNVRv) page plays them side by side
at the 300×90 the host uses, with a glimpse test.

| Key | What it is | Cycle | Source |
|---|---|---|---|
| `stamp` | A registry stamp drops, presses, lifts; the impression fades. The most literal — stamping is what a registry does. | 1.10 s | `make-loading-concepts.py` |
| `gears` | Two cogs in the line weight of the patent drawings. Turns continuously, so no glimpse catches it at rest. | 2.00 s | `make-loading-concepts.py` |
| `tiles` | Three trademark tiles pulsing in sequence, echoing the grid on the archive's homepage. | 1.20 s | `make-loading-concepts.py` |
| `blots` | Ink dots that swell and settle, unevenly. The stock idea in this archive's ink. | 1.00 s | `make-loading-concepts.py` |
| `compact` | A pen writing a small dense mark on a ruled line. | 1.10 s | `make-loading-animation.py` |
| `loop` | The pen writing a cursive loop instead of a wave. | 1.20 s | `make-loading-animation.py` |
| `flourish` | The pen's wide gesture, fast and thickened. | 1.00 s | `make-loading-animation.py` |
| `original` | The first pen attempt, kept as the reference for what not to do. | 2.67 s | `make-loading-animation.py` |

### What makes a loader readable

Worth keeping, because the first attempt got it wrong and the reason was not obvious.

A spinner is often on screen for well under a second. The original pen ran a 2.67-second
cycle as a 3.6px line spread over 250px, so nobody ever saw the mark finish — just a stub of
line and a pen that had barely moved. The stock dots read because their whole gesture repeats
about twice a second: any glimpse contains a complete motion.

So the levers are tempo and ink density, not colour:

- **Cycle near a second**, so a glimpse contains a whole gesture.
- **Ink per pixel** — a compact mark at 5–6px reads where a thin wide one does not.
- **Something at frame zero.** The pen variants gained a faint ruled line to write *on*; the
  tiles and blots never fade below about 35% opacity. A stagger that fades each element to
  nothing leaves frames with an empty canvas, which is most of what makes a loader feel like
  nothing is happening.

### How the pen ones are built

Everything comes from one curve: the ink is a Lottie trim-path along it and the pen's
position keyframes are sampled from that same curve, so the pen cannot drift off its own
line. Arc-length parameterised, so it writes at an even speed instead of hurrying through the
flat parts. The pen does not rotate — a version that turned it to face the tangent read as an
arrowhead skidding along a wave, because a hand holds a pen at a fixed attitude and moves it.

## Regenerating the photographic images

The JPEG conversions above were one-off Pillow calls at the stated quality settings. If a
source is replaced, re-run the same conversion rather than dropping the raw file into
`src/` — `PATENT-HP-FULL.jpg` alone is 979 KB, and the package ships on every page load.
