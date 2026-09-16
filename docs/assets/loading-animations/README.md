# Loading animation candidates

Eight candidate Lottie animations for the Primo NDE boot screen, plus the generator that
produces them and the gallery used to choose between them.

**Nothing here ships.** Primo fetches exactly one animation per customization package, at
`assets/images/loadingAnimations/LoadingAnimationJson.json` (Ex Libris case 10665359 — see
`docs/troubleshooting/loading-animation-color-not-themed.md` for how that was established).
The chosen candidate is copied over `src/assets/views/nde/images/loadingAnimations/LoadingAnimationJson.json`;
the rest stay here as the record of what was considered.

They live under `docs/` rather than `src/assets/` deliberately: `angular.json` copies the whole
of `src/assets` into every package, so candidates parked there would ride along into production
zips.

## The candidates

| id | family | what it is |
|---|---|---|
| `cog-magnifier` | logo | The logo's magnifier with a geared rim, turning while the lens mark breathes. |
| `letters-assembling` | logo | D a T A drops in one letter at a time, holds, clears, repeats. |
| `scan-sweep` | logo | A magnifier glides over three lines of text, leaving what it passed in logo blue. |
| `ring-orbit` | logo | The logo held still, with the lens mark orbiting inside the ring. |
| `book-equalizer` | library | Five spines rising and falling in a wave travelling along the shelf. |
| `page-flip` | library | An open book with pages turning continuously. |
| `shelving` | library | Books slide in and fill the shelf left to right, then the row clears. |
| `knowledge-orbit` | library | A book at the centre of two tilted orbits with dots travelling them. |

All eight share a 300×90 canvas (the Ex Libris default's, so the host reserves the same box) and
one blue ramp: `#003b7e → #0052b3 → #538bcc → #b0c9e7`, plus `#66bff1` sampled from the DaTA
logo. A custom animation does **not** follow the view's `--sys-primary`, so its colours have to
be right in the file.

## Regenerating

```bash
node docs/assets/loading-animations/generate.mjs
```

Rewrites all eight `.json` files, `index.json`, and `gallery.html`. Edit `generate.mjs`, never
the `.json` files — they are output. To retune the palette for every candidate at once, change
the constants at the top of the generator.

`gallery.html` is gitignored: it is 113 KB of inlined Lottie rebuilt from
`gallery.template.html` and the candidates, both of which are tracked.

## Reviewing

`gallery.html` is a self-contained page that plays all eight side by side on the real (white)
boot background, with size and speed controls. Open it locally, or publish it — it needs only
`lottie-web` from a CDN and carries the animation data inline.

## Authoring notes

Everything is hand-built Lottie shape layers in absolute composition coordinates. Three things
were avoided on purpose, because the animation is parsed by whatever `lottie-web` build the
Primo host ships and there is no way to test every patron's renderer:

- **no text layers** — the "DaTA" glyphs are bezier outlines, so nothing depends on a font
  resolving in the viewer's browser;
- **no track mattes** — `scan-sweep` reveals its highlight by animating a rect's width rather
  than masking, which needs no matte support;
- **no expressions**.

Two structural rules the generator enforces, both of which broke a candidate during authoring:

- keyframe times must strictly increase, so `A()` drops collisions (staggered timelines collide
  at `t=0` whenever a stagger offset is zero);
- a property's first and last keyframe should match or the loop visibly jumps. Three deliberate
  exceptions remain: the two rotations that wrap (a whole number of turns, or of gear teeth),
  and `page-flip`, where the lifted page lands exactly on the static page below it and is hidden
  there.
