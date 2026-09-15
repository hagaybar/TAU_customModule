"""Four loading animations in directions other than the writing pen.

All are Lottie (the host hands that path to a Lottie player, so an SVG renders nothing), all
on the 300x90 canvas the host uses, all in the theme's brown, and all built to the same rule
the pen taught: a loader has to read in a glimpse, so the cycle stays near a second and the
canvas is never empty at frame zero.

    python3 docs/assets/TMA/make-loading-concepts.py

Each concept comes from the archive's own world rather than from a stock loader:

  stamp   A registry stamp drops, presses, lifts, and the impression it leaves fades.
          The most literal — this is a registry, and stamping is what a registry does.
  tiles   Three trademark tiles pulse in sequence, echoing the grid of marks on the
          archive's own homepage. Says "collection" rather than "machine working".
  gears   Two cogs turning, drawn in the line weight of the patent drawings behind the
          banner. Continuously in motion, so no glimpse ever catches it at rest.
  blots   Ink dots that swell and settle, unevenly, the way ink does. The closest to the
          stock dots and the most neutral, but in this archive's ink rather than Ex Libris'.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT_DIR = os.path.join(HERE, 'loading-variants')

W, H = 300, 90
FPS = 60
INK = [0.306, 0.271, 0.255, 1]      # #4e4541
CX, CY = W / 2, H / 2


# ── Lottie scaffolding ──────────────────────────────────────────────────────────────────

def val(v):
    return {'a': 0, 'k': v}


def anim(keys, hold_last=True):
    """Keyframes as [(frame, value), ...]; smooth easing between them."""
    out = []
    for i, (t, v) in enumerate(keys):
        kf = {'t': t, 's': v if isinstance(v, list) else [v]}
        if i < len(keys) - 1:
            n = len(kf['s'])
            kf['i'] = {'x': [0.45] * n, 'y': [1] * n}
            kf['o'] = {'x': [0.55] * n, 'y': [0] * n}
        out.append(kf)
    return {'a': 1, 'k': out}


def transform(pos=(0, 0), anchor=(0, 0), scale=(100, 100), rot=0, opacity=100):
    return {'ty': 'tr', 'p': pos if isinstance(pos, dict) else val(list(pos)),
            'a': anchor if isinstance(anchor, dict) else val(list(anchor)),
            's': scale if isinstance(scale, dict) else val(list(scale)),
            'r': rot if isinstance(rot, dict) else val(rot),
            'o': opacity if isinstance(opacity, dict) else val(opacity),
            'sk': val(0), 'sa': val(0)}


def layer(name, ind, shapes, op, ks=None):
    base = {'o': val(100), 'r': val(0), 'p': val([0, 0, 0]),
            'a': val([0, 0, 0]), 's': val([100, 100, 100])}
    base.update(ks or {})
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': base,
            'ao': 0, 'ip': 0, 'op': op, 'st': 0, 'bm': 0, 'shapes': shapes}


def fill(opacity=100):
    return {'ty': 'fl', 'nm': 'f', 'c': val(INK), 'o': val(opacity), 'r': 1}


def stroke(width, opacity=100):
    return {'ty': 'st', 'nm': 's', 'c': val(INK), 'o': val(opacity),
            'w': val(width), 'lc': 2, 'lj': 2, 'ml': 4}


def ellipse(size, pos=(0, 0)):
    return {'ty': 'el', 'nm': 'e', 'p': val(list(pos)), 's': val(list(size))}


def rect(size, pos=(0, 0), radius=0):
    return {'ty': 'rc', 'nm': 'r', 'p': val(list(pos)), 's': val(list(size)), 'r': val(radius)}


def cog(outer, inner, teeth):
    return {'ty': 'sr', 'nm': 'cog', 'sy': 1, 'pt': val(teeth), 'p': val([0, 0]),
            'r': val(0), 'or': val(outer), 'ir': val(inner),
            'os': val(0), 'is': val(0)}


def comp(name, layers, frames):
    return {'v': '5.7.5', 'fr': FPS, 'ip': 0, 'op': frames, 'w': W, 'h': H,
            'nm': f'TMA loading — {name}', 'ddd': 0, 'assets': [],
            'layers': layers, 'markers': []}


# ── Concepts ────────────────────────────────────────────────────────────────────────────

def build_stamp():
    """A registry stamp drops, presses, lifts; the impression it leaves fades behind it."""
    F = 66
    press, lift = 20, 30

    # The impression: a ring with a bar through it, the shape a rubber stamp leaves.
    impression = [{'ty': 'gr', 'nm': 'mark', 'it': [
        ellipse((44, 44)), stroke(3.4),
        transform(scale=anim([(press, [70, 70]), (press + 5, [104, 104]), (F, [104, 104])]),
                  opacity=anim([(0, 0), (press, 0), (press + 4, 100),
                                (F - 10, 100), (F, 0)])),
    ]}, {'ty': 'gr', 'nm': 'bar', 'it': [
        rect((26, 3.4), radius=1.7), fill(),
        transform(scale=anim([(press, [70, 70]), (press + 5, [104, 104]), (F, [104, 104])]),
                  opacity=anim([(0, 0), (press, 0), (press + 4, 100),
                                (F - 10, 100), (F, 0)])),
    ]}]

    # The stamp body: handle above a press block, dropping onto the mark.
    body = [{'ty': 'gr', 'nm': 'block', 'it': [
        rect((58, 16), pos=(0, 0), radius=3), fill(),
        transform(),
    ]}, {'ty': 'gr', 'nm': 'stem', 'it': [
        rect((14, 14), pos=(0, -14), radius=2), fill(),
        transform(),
    ]}, {'ty': 'gr', 'nm': 'knob', 'it': [
        ellipse((36, 18), pos=(0, -26)), fill(),
        transform(),
    ]}]

    stamp_layer = layer('Stamp', 1, body, F, ks={
        'p': anim([(0, [CX, CY - 46, 0]), (press, [CX, CY - 13, 0]),
                   (press + 6, [CX, CY - 16, 0]), (lift + 16, [CX, CY - 46, 0]),
                   (F, [CX, CY - 46, 0])]),
        # A touch of squash on contact, so it lands rather than stops.
        's': anim([(press - 3, [100, 100, 100]), (press + 2, [107, 92, 100]),
                   (press + 8, [100, 100, 100])]),
        'o': anim([(0, 100), (lift + 20, 100), (F - 2, 100)]),
    })
    mark_layer = layer('Impression', 2, impression, F, ks={'p': val([CX, CY + 16, 0])})
    return comp('Registry stamp', [stamp_layer, mark_layer], F)


def build_tiles():
    """Three trademark tiles pulsing in sequence — the grid on the archive's own homepage."""
    F = 72
    step = 10
    layers = []
    for i, x in enumerate((-46, 0, 46)):
        t0 = i * step
        layers.append(layer(f'Tile {i + 1}', i + 1, [{'ty': 'gr', 'nm': 'tile', 'it': [
            rect((34, 34), radius=7), fill(),
            transform(),
        ]}], F, ks={
            'p': val([CX + x, CY, 0]),
            's': anim([(t0, [78, 78, 100]), (t0 + 9, [100, 100, 100]),
                       (t0 + 22, [78, 78, 100]), (F, [78, 78, 100])]),
            # Never fully out: the row of tiles stays legible even at the quietest frame.
            'o': anim([(t0, 34), (t0 + 9, 100), (t0 + 22, 34), (F, 34)]),
        }))
    return comp('Trademark tiles', layers, F)


def build_gears():
    """Two cogs in the line weight of the patent drawings. Always turning, never at rest."""
    F = 120
    big = [{'ty': 'gr', 'nm': 'cog', 'it': [
        cog(22, 16, 12), stroke(2.6), transform(),
    ]}, {'ty': 'gr', 'nm': 'hub', 'it': [
        ellipse((13, 13)), stroke(2.2), transform(),
    ]}]
    small = [{'ty': 'gr', 'nm': 'cog', 'it': [
        cog(15, 10.5, 9), stroke(2.6), transform(),
    ]}, {'ty': 'gr', 'nm': 'hub', 'it': [
        ellipse((9, 9)), stroke(2.2), transform(),
    ]}]
    gear_a = layer('Cog A', 1, big, F, ks={
        'p': val([CX - 19, CY - 4, 0]),
        'r': anim([(0, 0), (F, 360 / 12 * 4)]),   # whole number of teeth, so the loop is seamless
    })
    gear_b = layer('Cog B', 2, small, F, ks={
        'p': val([CX + 19, CY + 9, 0]),
        'r': anim([(0, 0), (F, -360 / 9 * 4)]),
    })
    return comp('Patent cogs', [gear_a, gear_b], F)


def build_blots():
    """Ink dots that swell and settle, unevenly — the stock dots, in this archive's ink."""
    F = 60
    step = 8
    layers = []
    # Deliberately unequal, and not evenly spaced: ink laid by hand is not a progress bar.
    for i, (x, r, bob) in enumerate(((-38, 13, 2.5), (-2, 15, 3.5), (36, 12, 2.0))):
        t0 = i * step
        layers.append(layer(f'Blot {i + 1}', i + 1, [{'ty': 'gr', 'nm': 'blot', 'it': [
            ellipse((r * 2, r * 2)), fill(), transform(),
        ]}], F, ks={
            'p': anim([(t0, [CX + x, CY + bob, 0]), (t0 + 8, [CX + x, CY - bob, 0]),
                       (t0 + 20, [CX + x, CY + bob, 0]), (F, [CX + x, CY + bob, 0])]),
            's': anim([(t0, [72, 72, 100]), (t0 + 8, [108, 108, 100]),
                       (t0 + 20, [72, 72, 100]), (F, [72, 72, 100])]),
            'o': anim([(t0, 40), (t0 + 8, 100), (t0 + 20, 40), (F, 40)]),
        }))
    return comp('Ink blots', layers, F)


CONCEPTS = [
    ('stamp', build_stamp),
    ('tiles', build_tiles),
    ('gears', build_gears),
    ('blots', build_blots),
]

os.makedirs(OUT_DIR, exist_ok=True)
for key, fn in CONCEPTS:
    data = fn()
    path = os.path.join(OUT_DIR, f'{key}.json')
    with open(path, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print(f"{key:8} {os.path.getsize(path):5} B  {data['op'] / FPS:.2f}s  "
          f"{len(data['layers'])} layers  -> {os.path.relpath(path, REPO)}")
