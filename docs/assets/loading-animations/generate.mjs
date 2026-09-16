#!/usr/bin/env node
/**
 * Generates the candidate Lottie loading animations for the Primo NDE boot screen.
 *
 * Primo fetches exactly ONE file per customization package —
 * `assets/images/loadingAnimations/LoadingAnimationJson.json` (Ex Libris case 10665359) — so these
 * are candidates to choose between, not files that all ship. The winner is copied over
 * `src/assets/views/nde/images/loadingAnimations/LoadingAnimationJson.json`.
 *
 * They live under docs/ rather than src/assets/ on purpose: angular.json copies the whole of
 * src/assets into every package, so candidates parked there would ride along into production zips.
 *
 * Run: node docs/assets/loading-animations/generate.mjs
 *
 * Everything is authored as Lottie shape layers in absolute composition coordinates (y grows
 * downward, origin top-left, canvas 300x90 to match the four-dot animation these replace). No
 * text layers, no track mattes, no expressions — those have renderer-dependent support, and this
 * file is parsed by whatever lottie-web build the Primo host ships.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

/* ── Canvas ──────────────────────────────────────────────────────────────────────────────────
 * 300x90 is the Ex Libris default animation's canvas. Keeping it means the host reserves the
 * same box and the page does not reflow when the animation is swapped.                        */
const W = 300;
const H = 90;
const FR = 60;

/* ── Palette ─────────────────────────────────────────────────────────────────────────────────
 * The four blues are the ramp already shipped in the current animation (the Ex Libris default
 * hue-rotated violet -> azure). AZURE is the DaTA logo's own blue, sampled from
 * src/assets/views/nde/images/library-logo.png.                                               */
const NAVY  = '#003b7e';
const DEEP  = '#0052b3';
const STEEL = '#538bcc';
const PALE  = '#b0c9e7';
const AZURE = '#66bff1';
const MIST  = '#dce9f7';

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

/* ── Property helpers ────────────────────────────────────────────────────────────────────────
 * A Lottie animated property is {a:1, k:[keyframe...]}. On keyframe N, `o` is the tangent
 * LEAVING N and `i` the tangent ARRIVING at N+1 — both live on the earlier keyframe, and the
 * final keyframe carries only `t`/`s`. Scalar-valued props still take arrays in `s`.          */
const S = (k) => ({ a: 0, k });

const EASE = {
  lin:  { o: { x: 0.333, y: 0.333 }, i: { x: 0.667, y: 0.667 } },
  both: { o: { x: 0.42,  y: 0     }, i: { x: 0.58,  y: 1     } },
  out:  { o: { x: 0,     y: 0     }, i: { x: 0.2,   y: 1     } },
  in:   { o: { x: 0.8,   y: 0     }, i: { x: 1,     y: 1     } },
};

const arr = (v) => (Array.isArray(v) ? v : [v]);
const kf = (t, s, ease = 'both') => ({ t, s: arr(s), ...EASE[ease] });
const end = (t, s) => ({ t, s: arr(s) });

/** Keyframe times must strictly increase or lottie-web's binary search misbehaves. Staggered
 *  timelines collide at t=0 whenever a stagger offset is 0 (the first item in a sequence), so
 *  collisions are dropped here rather than special-cased at every call site — the later
 *  keyframe wins, which is the one carrying the real value. */
const A = (keys) => ({
  a: 1,
  k: keys.filter((key, i) => i === keys.length - 1 || keys[i + 1].t !== key.t),
});

/** Samples fn(phase) at `n` evenly spaced points over [0,dur] and returns linear keyframes.
 *  Used for sine waves and elliptical paths, where hand-placed keyframes would be guesswork.
 *  fn receives phase in 0..1; fn(1) must equal fn(0) or the loop will jump.                   */
const sampled = (dur, n, fn) => A(
  Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.round((dur * i) / n);
    return i === n ? end(t, fn(1)) : kf(t, fn(i / n), 'lin');
  }),
);

/* ── Shape helpers ───────────────────────────────────────────────────────────────────────────
 * Item order inside a group is [shapes..., style, tr] — a fill applies to every path above it,
 * which is how a letter counter or a ring is punched out with fill rule 2 (even-odd).         */
const ell = (cx, cy, w, h) => ({ ty: 'el', d: 1, p: S([cx, cy]), s: S([w, h]), nm: 'ellipse' });

const rect = (cx, cy, w, h, r = 0) =>
  ({ ty: 'rc', d: 1, p: S([cx, cy]), s: S([w, h]), r: S(r), nm: 'rect' });

const star = (cx, cy, points, outer, inner, round = 0) => ({
  ty: 'sr', d: 1, sy: 1, p: S([cx, cy]), pt: S(points), r: S(0),
  or: S(outer), os: S(round), ir: S(inner), is: S(round), nm: 'star',
});

/** Closed polygon / bezier path. `pts` is [[x,y], ...]; `tangents` maps a vertex index to
 *  {i:[dx,dy], o:[dx,dy]} relative to that vertex. Omitted vertices get straight segments.
 *  Every path drawn here is wound the same way (positive shoelace) so that overlapping parts
 *  of one glyph merge under the nonzero fill rule instead of punching each other out.         */
const path = (pts, tangents = {}) => ({
  ty: 'sh', ind: 0, nm: 'path',
  ks: S({
    v: pts,
    i: pts.map((_, k) => tangents[k]?.i ?? [0, 0]),
    o: pts.map((_, k) => tangents[k]?.o ?? [0, 0]),
    c: true,
  }),
});

const fill = (hex, rule = 1) =>
  ({ ty: 'fl', c: S(rgb(hex)), o: S(100), r: rule, bm: 0, nm: 'fill' });

const fillOpacity = (hex, o, rule = 1) =>
  ({ ty: 'fl', c: S(rgb(hex)), o: S(o), r: rule, bm: 0, nm: 'fill' });

const stroke = (hex, width) => ({
  ty: 'st', c: S(rgb(hex)), o: S(100), w: S(width),
  lc: 2, lj: 2, ml: 4, bm: 0, nm: 'stroke',
});

const trim = (start, endPct, offset = 0) =>
  ({ ty: 'tm', s: S(start), e: S(endPct), o: S(offset), m: 1, nm: 'trim' });

const xf = (t = {}) => ({
  ty: 'tr',
  p: t.p ?? S([0, 0]), a: t.a ?? S([0, 0]), s: t.s ?? S([100, 100]),
  r: t.r ?? S(0), o: t.o ?? S(100), sk: S(0), sa: S(0), nm: 'transform',
});

const group = (items, t = {}) =>
  ({ ty: 'gr', bm: 0, hd: false, nm: t.nm ?? 'group', it: [...items, xf(t)] });

/** A shape layer, left at p=a=[0,0] so shape coordinates are composition coordinates. */
let layerIndex = 0;
const layer = (shapes, dur, t = {}) => ({
  ddd: 0, ind: (layerIndex += 1), ty: 4, nm: t.nm ?? 'layer', sr: 1,
  ks: {
    o: t.o ?? S(100), r: t.r ?? S(0), p: t.p ?? S([0, 0]),
    a: t.a ?? S([0, 0]), s: t.s ?? S([100, 100]),
  },
  ao: 0, shapes, ip: 0, op: dur, st: 0, bm: 0,
});

/** Layers draw back-to-front in REVERSE array order: layers[0] ends up on top. */
const comp = (name, dur, build) => {
  layerIndex = 0;
  return {
    v: '5.7.5', fr: FR, ip: 0, op: dur, w: W, h: H, nm: name,
    ddd: 0, assets: [], layers: build(),
  };
};

const TAU = Math.PI * 2;

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 1. Cog magnifier — the logo's magnifier with the ring's rim turned into gear teeth.
 * The ring turns by whole teeth per loop, which is what makes the cycle seamless.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function cogMagnifier() {
  const dur = 108;
  const cx = 150;
  const cy = 40;
  const teeth = 8;

  return comp('TAU NDE loading — cog magnifier', dur, () => [
    layer([
      group([ell(0, 0, 15, 15), fill(NAVY)], {
        nm: 'lens mark',
        p: S([cx, cy]),
        s: sampled(dur, 16, (ph) => { const k = 100 + 16 * Math.sin(ph * TAU); return [k, k]; }),
        o: sampled(dur, 16, (ph) => 80 + 20 * Math.sin(ph * TAU)),
      }),
    ], dur, { nm: 'lens mark' }),

    layer([
      // A solid gear ring: the toothed star with a round hole punched out of it by the even-odd
      // fill rule. Stroking the star instead left it reading as a rosette rather than a rim.
      group([star(0, 0, teeth, 28, 22, 62), ell(0, 0, 34, 34), fill(AZURE, 2)], {
        nm: 'rim',
        p: S([cx, cy]),
        // Turning by whole teeth per loop is what makes the cycle seamless.
        r: A([kf(0, 0, 'lin'), end(dur, (360 / teeth) * 2)]),
      }),
    ], dur, { nm: 'gear' }),

    layer([
      group([rect(0, 0, 17, 17, 2.5), fill(AZURE)], {
        nm: 'diamond',
        p: S([cx - 24, cy + 24]),
        r: S(45),
        s: sampled(dur, 16, (ph) => { const k = 100 + 8 * Math.sin(ph * TAU); return [k, k]; }),
      }),
    ], dur, { nm: 'handle' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 2. Letters assembling — D a T A drops in one letter at a time, holds, clears, repeats.
 * The glyphs are hand-built outlines rather than Lottie text layers: a text layer would depend
 * on a font being resolvable in every patron's browser and on the host's renderer supporting
 * text at all. Colours follow the wordmark, where "Da" is dark and "TA" is the logo blue.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function lettersAssembling() {
  const dur = 108;
  const capTop = 23;   // 44px cap height, vertically centred in the 90px canvas

  // Letter boxes are laid out left to right and the run is centred on x=150.
  const glyphD = (x, c) => group([
    path(
      [[x, capTop], [x + 20, capTop], [x + 36, capTop + 22], [x + 20, capTop + 44], [x, capTop + 44]],
      { 1: { o: [8.8, 0] }, 2: { i: [0, -12.1], o: [0, 12.1] }, 3: { i: [8.8, 0] } },
    ),
    path(
      [[x + 11, capTop + 11], [x + 17, capTop + 11], [x + 25, capTop + 22],
       [x + 17, capTop + 33], [x + 11, capTop + 33]],
      { 1: { o: [4.4, 0] }, 2: { i: [0, -6.1], o: [0, 6.1] }, 3: { i: [4.4, 0] } },
    ),
    fill(c, 2),
  ], { nm: 'D' });

  // Single-storey geometric "a": a ring (even-odd) plus its own stem group.
  const glyphA = (x, c) => [
    group([ell(x + 14, capTop + 28, 28, 28), ell(x + 14, capTop + 28, 14, 14), fill(c, 2)],
      { nm: 'a bowl' }),
    group([rect(x + 29, capTop + 28, 8, 32), fill(c)], { nm: 'a stem' }),
  ];

  const glyphT = (x, c) => group([
    path([[x, capTop], [x + 34, capTop], [x + 34, capTop + 11], [x, capTop + 11]]),
    path([[x + 11.5, capTop + 11], [x + 22.5, capTop + 11],
          [x + 22.5, capTop + 44], [x + 11.5, capTop + 44]]),
    fill(c),
  ], { nm: 'T' });

  const glyphCapA = (x, c) => group([
    path([[x + 15, capTop], [x + 25, capTop], [x + 10, capTop + 44], [x, capTop + 44]]),
    path([[x + 15, capTop], [x + 25, capTop], [x + 40, capTop + 44], [x + 30, capTop + 44]]),
    path([[x + 10, capTop + 28], [x + 30, capTop + 28],
          [x + 30, capTop + 37], [x + 10, capTop + 37]]),
    fill(c),
  ], { nm: 'A' });

  const letters = [
    { shapes: [glyphD(70.5, NAVY)] },
    { shapes: glyphA(112.5, NAVY) },
    { shapes: [glyphT(151.5, AZURE)] },
    { shapes: [glyphCapA(189.5, AZURE)] },
  ];

  const HOLD_END = 84;
  const CLEARED = 102;

  return comp('TAU NDE loading — DaTA letters', dur, () => letters.map((letter, i) => {
    const enter = i * 16;
    return layer(letter.shapes, dur, {
      nm: `letter ${i}`,
      o: A([
        kf(0, 0, 'lin'), kf(enter, 0, 'out'), kf(enter + 12, 100, 'lin'),
        kf(HOLD_END, 100, 'in'), kf(CLEARED, 0, 'lin'), end(dur, 0),
      ]),
      // The jump back to the start position happens one frame after the letters are invisible.
      p: A([
        kf(0, [0, -16], 'lin'), kf(enter, [0, -16], 'out'), kf(enter + 12, [0, 0], 'lin'),
        kf(HOLD_END, [0, 0], 'in'), kf(CLEARED, [0, 10], 'lin'),
        kf(CLEARED + 1, [0, -16], 'lin'), end(dur, [0, -16]),
      ]),
    });
  }));
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 3. Scan sweep — a magnifier glides over three lines of "text", and everything it has passed
 * is left in the logo blue. The revealed part is a second copy of each line whose width tracks
 * the lens, rather than a track matte, because matte support varies by renderer.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function scanSweep() {
  const dur = 144;
  const x0 = 104;
  const travel = 96;
  const lines = [{ y: 30, w: 88 }, { y: 45, w: 70 }, { y: 60, w: 54 }];

  // Smooth ping-pong: starts and ends at the left edge, so the loop has no visible seam.
  const lensX = (ph) => x0 + travel * (0.5 - 0.5 * Math.cos(ph * TAU));

  const revealed = ({ y, w }) => {
    const width = (ph) => Math.min(Math.max(lensX(ph) - x0, 0.01), w);
    return group([
      {
        ty: 'rc', d: 1, nm: 'rect', r: S(3.5),
        p: sampled(dur, 48, (ph) => [x0 + width(ph) / 2, y]),
        s: sampled(dur, 48, (ph) => [width(ph), 7]),
      },
      fill(AZURE),
    ], { nm: `revealed ${y}` });
  };

  return comp('TAU NDE loading — scan sweep', dur, () => [
    layer([
      group([
        // Handle on the lower left, the side the logo's magnifier puts it on.
        group([rect(0, 0, 15, 7, 3.5), fill(NAVY)], { nm: 'handle', p: S([-14, 14]), r: S(-45) }),
        group([ell(0, 0, 30, 30), fillOpacity(AZURE, 22)], { nm: 'glass' }),
        group([ell(0, 0, 30, 30), stroke(NAVY, 4)], { nm: 'rim' }),
      ], { nm: 'lens', p: sampled(dur, 48, (ph) => [lensX(ph), 45]) }),
    ], dur, { nm: 'magnifier' }),

    layer(lines.map(revealed), dur, { nm: 'revealed text' }),

    layer(lines.map(({ y, w }) =>
      group([rect(x0 + w / 2, y, w, 7, 3.5), fill(PALE)], { nm: `line ${y}` })),
    dur, { nm: 'text lines' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 4. Ring orbit — the logo's broken ring and diamond held still while the lens mark orbits
 * inside it. Closest in spirit to the four dots it replaces: one moving element, nothing else.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function ringOrbit() {
  const dur = 84;
  const cx = 150;
  const cy = 42;

  return comp('TAU NDE loading — ring orbit', dur, () => [
    layer([
      group([ell(17, 0, 11, 11), fill(NAVY)], {
        nm: 'dot',
        p: S([cx, cy]),
        r: A([kf(0, 0, 'lin'), end(dur, 360)]),
      }),
    ], dur, { nm: 'orbiting mark' }),

    layer([
      // Trim leaves the gap the logo has at the lower left; the offset rotates it into place.
      group([ell(0, 0, 56, 56), trim(0, 78, -82), stroke(AZURE, 7)], { nm: 'ring', p: S([cx, cy]) }),
    ], dur, { nm: 'ring' }),

    layer([
      group([rect(0, 0, 15, 15, 2), fill(AZURE)], { nm: 'diamond', p: S([cx - 24, cy + 24]), r: S(45) }),
    ], dur, { nm: 'handle' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 5. Book equalizer — spines rising and falling in a travelling wave on a shelf.
 * Each spine is scaled about its base rather than resized, so the bands near its head stay
 * proportionally placed and never escape the top of the book.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function bookEqualizer() {
  const dur = 96;
  const baseline = 71;
  const bodyHeight = 44;
  const colours = [NAVY, DEEP, STEEL, PALE, AZURE];
  const pitch = 22;
  const first = 150 - ((colours.length - 1) * pitch) / 2;

  return comp('TAU NDE loading — book equalizer', dur, () => [
    layer(colours.map((colour, i) => {
      const band = colour === PALE || colour === AZURE ? NAVY : MIST;
      // Body and bands are nested groups under one animated transform, so the bands ride the
      // spine's scale instead of needing a duplicate copy of its keyframes.
      return group([
        group([rect(0, -bodyHeight + 8, 10, 2.5, 1.2),
               rect(0, -bodyHeight + 13.5, 10, 2.5, 1.2), fill(band)], { nm: 'bands' }),
        group([rect(0, -bodyHeight / 2, 15, bodyHeight, 2), fill(colour)], { nm: 'body' }),
      ], {
        nm: `spine ${i}`,
        p: S([first + i * pitch, baseline]),
        s: sampled(dur, 24, (ph) => {
          const k = 78 + 26 * Math.sin((ph - i / colours.length) * TAU);
          return [100, k];
        }),
      });
    }), dur, { nm: 'spines' }),

    layer([
      group([rect(150, 73, 124, 4, 2), fill(NAVY)], { nm: 'shelf' }),
    ], dur, { nm: 'shelf' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 6. Page flip — an open book with pages turning continuously. A flipping page is the right
 * page scaled about the spine from +100% to -100%: it folds to nothing at the spine and lands
 * exactly on the left page, where it can be hidden without a visible cut. Two flippers take
 * alternate halves of the cycle so a page is always in the air.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function pageFlip() {
  const dur = 96;
  const flip = dur / 2;
  const spine = 150;
  const mid = 45;

  /** One page, bowed along its outer edge, as offsets from an origin. dir +1 is the right page. */
  const pageShape = (dir, ox, oy) => path(
    [[ox, oy - 20], [ox + dir * 50, oy - 15], [ox + dir * 50, oy + 17], [ox, oy + 20]],
    {
      0: { o: [dir * 22, -3] }, 1: { i: [-dir * 20, -2] },
      2: { o: [-dir * 20, 2] }, 3: { i: [dir * 22, 3] },
    },
  );

  const textLines = (dir) => group([
    rect(spine + dir * 26, mid - 6, 28, 1.8, 0.9),
    rect(spine + dir * 26, mid + 1, 28, 1.8, 0.9),
    rect(spine + dir * 26, mid + 8, 22, 1.8, 0.9),
    fillOpacity(STEEL, 60),
  ], { nm: `text ${dir}` });

  // Drawn relative to the book's centre so the mid-flip y bulge grows about the middle of the
  // page rather than pushing it down the canvas. The lifted sheet is deliberately lighter and
  // darker-edged than the pages beneath it, or the flip is invisible until it is half folded.
  const flipper = (offset) => layer([
    group([
      pageShape(1, 0, 0),
      fill(MIST),
      stroke(NAVY, 1.6),
    ], { nm: 'page' }),
  ], dur, {
    nm: `flipper ${offset}`,
    p: S([spine, 44]),
    // Scale about the spine; the mid-flip y bulge reads as the page curving.
    s: A(offset === 0
      ? [kf(0, [100, 100]), kf(flip / 2, [0, 107], 'lin'), kf(flip, [-100, 100], 'lin'),
         end(dur, [-100, 100])]
      : [kf(0, [-100, 100], 'lin'), kf(flip, [100, 100]), kf(flip + flip / 2, [0, 107], 'lin'),
         end(dur, [-100, 100])]),
    o: A(offset === 0
      ? [kf(0, 100, 'lin'), kf(flip - 2, 100, 'lin'), kf(flip - 1, 0, 'lin'), end(dur, 0)]
      : [kf(0, 0, 'lin'), kf(flip - 1, 0, 'lin'), kf(flip, 100, 'lin'), end(dur, 100)]),
  });

  return comp('TAU NDE loading — page flip', dur, () => [
    layer([group([rect(spine, mid, 4, 44, 1), fill(NAVY)], { nm: 'spine' })], dur, { nm: 'spine' }),
    flipper(0),
    flipper(flip),
    layer([
      textLines(1),
      textLines(-1),
      group([pageShape(1, spine, mid), fill(PALE), stroke(STEEL, 1.5)], { nm: 'right page' }),
      group([pageShape(-1, spine, mid), fill(PALE), stroke(STEEL, 1.5)], { nm: 'left page' }),
    ], dur, { nm: 'open book' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 7. Shelving — books slide in from the right and fill the shelf left to right, then the whole
 * row clears. Each book tips upright as it lands, rotating about its own base.
 * Books fill left-to-right, so an arriving book only ever crosses empty slots.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function shelving() {
  const dur = 112;
  const baseline = 72;
  const books = [
    { h: 40, c: NAVY }, { h: 34, c: STEEL }, { h: 44, c: DEEP }, { h: 37, c: AZURE },
  ];
  const pitch = 22;
  const first = 150 - ((books.length - 1) * pitch) / 2;
  const OFFSTAGE = 252;
  const HOLD_END = 84;
  const CLEARED = 104;

  return comp('TAU NDE loading — shelving', dur, () => [
    layer(books.map(({ h, c }, i) => {
      const enter = i * 14;
      const slot = first + i * pitch;
      const band = c === AZURE ? NAVY : MIST;
      return group([
        group([rect(0, -h + 8, 13, 2.5, 1.2), rect(0, -h + 13.5, 13, 2.5, 1.2), fill(band)],
          { nm: 'bands' }),
        group([rect(0, -h / 2, 18, h, 2), fill(c)], { nm: 'body' }),
      ], {
        nm: `book ${i}`,
        p: A([
          kf(0, [OFFSTAGE, baseline], 'lin'), kf(enter, [OFFSTAGE, baseline], 'out'),
          kf(enter + 22, [slot, baseline], 'lin'), kf(HOLD_END, [slot, baseline], 'in'),
          kf(CLEARED, [40, baseline], 'lin'), kf(CLEARED + 1, [OFFSTAGE, baseline], 'lin'),
          end(dur, [OFFSTAGE, baseline]),
        ]),
        r: A([
          kf(0, 12, 'lin'), kf(enter, 12, 'out'), kf(enter + 22, 0, 'lin'),
          kf(CLEARED, 0, 'lin'), kf(CLEARED + 1, 12, 'lin'), end(dur, 12),
        ]),
        o: A([
          kf(0, 0, 'lin'), kf(enter, 0, 'lin'), kf(enter + 8, 100, 'lin'),
          kf(HOLD_END + 4, 100, 'lin'), kf(CLEARED, 0, 'lin'), end(dur, 0),
        ]),
      });
    }), dur, { nm: 'books' }),

    layer([
      group([rect(150, 74, 144, 4, 2), fill(NAVY)], { nm: 'shelf' }),
    ], dur, { nm: 'shelf' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * 8. Knowledge orbit — a book at the centre with two tilted orbits. The travelling dots are
 * position keyframes sampled along the true ellipse rather than a dot inside a squashed group,
 * which would flatten the dot itself into an oval.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */
function knowledgeOrbit() {
  const dur = 120;
  const cx = 150;
  const cy = 45;
  const rx = 44;
  const ry = 19;

  const onOrbit = (tiltDeg, phase0) => sampled(dur, 48, (ph) => {
    const a = (tiltDeg * Math.PI) / 180;
    const phi = phase0 + ph * TAU;
    const lx = rx * Math.cos(phi);
    const ly = ry * Math.sin(phi);
    return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)];
  });

  return comp('TAU NDE loading — knowledge orbit', dur, () => [
    layer([
      group([ell(0, 0, 10, 10), fill(AZURE)], { nm: 'dot a', p: onOrbit(28, 0) }),
      group([ell(0, 0, 10, 10), fill(DEEP)], { nm: 'dot b', p: onOrbit(-28, Math.PI) }),
    ], dur, { nm: 'travelling dots' }),

    layer([
      group([rect(161, cy, 4, 30, 1), fill(MIST)], { nm: 'fore edge' }),
      group([rect(139.5, cy, 5, 36), fill(AZURE)], { nm: 'spine stripe' }),
      group([rect(cx, cy, 28, 36, 2.5), fill(NAVY)], { nm: 'cover' }),
    ], dur, {
      nm: 'book',
      // A layer transform is translate(p) · scale(s) · translate(-a). Setting p and a to the same
      // point leaves the shapes where they were drawn and pivots the breathing scale on the book.
      a: S([cx, cy]),
      p: S([cx, cy]),
      s: sampled(dur, 16, (ph) => { const k = 100 + 4 * Math.sin(ph * TAU); return [k, k]; }),
    }),

    layer([
      group([ell(0, 0, rx * 2, ry * 2), stroke(PALE, 2)], { nm: 'orbit a', p: S([cx, cy]), r: S(28) }),
      group([ell(0, 0, rx * 2, ry * 2), stroke(PALE, 2)], { nm: 'orbit b', p: S([cx, cy]), r: S(-28) }),
    ], dur, { nm: 'orbits' }),
  ]);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════ */

const CANDIDATES = [
  { id: 'cog-magnifier',      family: 'logo',    title: 'Cog magnifier',
    blurb: "The logo's magnifier with a geared rim, turning while the lens mark breathes.",
    build: cogMagnifier },
  { id: 'letters-assembling', family: 'logo',    title: 'Letters assembling',
    blurb: 'D a T A drops in one letter at a time, holds, clears, repeats.',
    build: lettersAssembling },
  { id: 'scan-sweep',         family: 'logo',    title: 'Scan sweep',
    blurb: 'A magnifier glides over three lines of text, leaving what it passed in logo blue.',
    build: scanSweep },
  { id: 'ring-orbit',         family: 'logo',    title: 'Ring orbit',
    blurb: 'The logo held still, with the lens mark orbiting inside the ring.',
    build: ringOrbit },
  { id: 'book-equalizer',     family: 'library', title: 'Book equalizer',
    blurb: 'Five spines rising and falling in a wave travelling along the shelf.',
    build: bookEqualizer },
  { id: 'page-flip',          family: 'library', title: 'Page flip',
    blurb: 'An open book with pages turning continuously.',
    build: pageFlip },
  { id: 'shelving',           family: 'library', title: 'Shelving',
    blurb: 'Books slide in and fill the shelf left to right, then the row clears.',
    build: shelving },
  { id: 'knowledge-orbit',    family: 'library', title: 'Knowledge orbit',
    blurb: 'A book at the centre of two tilted orbits with dots travelling them.',
    build: knowledgeOrbit },
];

const index = CANDIDATES.map(({ id, family, title, blurb, build }) => {
  const data = build();
  const json = `${JSON.stringify(data)}\n`;
  writeFileSync(join(OUT_DIR, `${id}.json`), json);
  return {
    id, family, title, blurb,
    seconds: +(data.op / FR).toFixed(2),
    bytes: Buffer.byteLength(json),
    data,
  };
});

writeFileSync(
  join(OUT_DIR, 'index.json'),
  `${JSON.stringify(index.map(({ data, ...meta }) => meta), null, 2)}\n`,
);

/* The review gallery inlines every animation rather than fetching them, so the published page is
 * a single self-contained file and cannot half-load. Regenerating the animations regenerates it. */
const template = readFileSync(join(OUT_DIR, 'gallery.template.html'), 'utf8');
writeFileSync(
  join(OUT_DIR, 'gallery.html'),
  template.replace('/*__CANDIDATES__*/null', JSON.stringify(index)),
);

const total = index.reduce((sum, c) => sum + c.bytes, 0);
console.log(`wrote ${index.length} candidates (${(total / 1024).toFixed(1)} KB), index.json`);
console.log(`wrote gallery.html in ${OUT_DIR}`);
