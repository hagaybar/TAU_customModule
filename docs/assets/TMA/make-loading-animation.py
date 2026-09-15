"""Generate TMA's loading animation: a pen writing, then the ink clearing so it loops.

The Primo host fetches assets/images/loadingAnimations/LoadingAnimationJson.json and plays
it while a page loads. It is a **Lottie** (bodymovin) file, not an SVG — the host hands that
path to a Lottie player, so an SVG there renders nothing. NDE already ships its own; TMA was
falling back to Ex Libris' stock dots because the file used to sit at a shared path.

    python3 docs/assets/TMA/make-loading-animation.py            # build the shipping one
    python3 docs/assets/TMA/make-loading-animation.py --variants  # build all, for comparison

── What makes a loader readable ────────────────────────────────────────────────────────

The first version was 2.7 seconds long, a 3.6px line spread over 250px. A spinner is often
on screen for well under a second, so in practice nobody ever saw the mark finish — just a
stub of line and a pen that had barely moved. The stock dots read because their whole
gesture repeats about twice a second: any glimpse shows a complete motion.

So the levers here are tempo and ink density, not colour:

  cycle        keep it near a second, so a short glimpse contains a whole gesture
  span/width   ink per pixel — a compact mark at 5-6px reads where a thin wide one does not
  baseline     a faint rule the pen writes *on*, so the canvas is never empty at frame 0

── How it is built ─────────────────────────────────────────────────────────────────────

Everything comes from one curve, which is the point: the ink is a Lottie trim-path along it
and the pen's position keyframes are sampled from the same curve, so the pen cannot drift
off its own line. Arc-length parameterised, so it writes at an even speed instead of
hurrying through the flat parts.

The pen does not rotate. A version that turned it to face the tangent read as an arrowhead
skidding along a wave — a hand holds a pen at a more or less fixed attitude and moves it.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SHIP_TO = os.path.join(REPO, 'src', 'assets', 'views', 'tma', 'images',
                       'loadingAnimations', 'LoadingAnimationJson.json')
VARIANT_DIR = os.path.join(HERE, 'loading-variants')

W, H = 300, 90            # the canvas the host's own animation uses
FPS = 60
INK = [0.306, 0.271, 0.255, 1]     # #4e4541 — the theme's on-surface-variant brown

# ── Variants ────────────────────────────────────────────────────────────────────────────
# `ship` marks the one written to the family folder. The rest exist to be compared.
VARIANTS = [
    {
        'key': 'compact',
        'title': 'Compact curl',
        'note': 'Small dense mark on a ruled line, ~1.1s. The most legible in a short glimpse.',
        'pts': [(96, 58), (120, 38), (144, 62), (168, 36), (192, 58), (212, 44)],
        'stroke': 5.5, 'pen': 1.0, 'baseline': True,
        'draw': 38, 'hold': 6, 'clear': 22,
        'ship': True,
    },
    {
        'key': 'loop',
        'title': 'Signature loop',
        'note': 'A cursive loop rather than a wave — more like a signature, ~1.2s.',
        'pts': [(94, 62), (116, 30), (138, 58), (124, 42), (152, 34), (178, 58), (206, 40)],
        'stroke': 5.5, 'pen': 1.0, 'baseline': True,
        'draw': 44, 'hold': 6, 'clear': 22,
        'ship': False,
    },
    {
        'key': 'flourish',
        'title': 'Quick flourish',
        'note': 'The original wide gesture, just fast and thicker. No ruled line, ~1.0s.',
        'pts': [(26, 60), (68, 34), (106, 66), (148, 28), (190, 62), (230, 36), (274, 52)],
        'stroke': 4.5, 'pen': 1.0, 'baseline': False,
        'draw': 36, 'hold': 4, 'clear': 20,
        'ship': False,
    },
    {
        'key': 'original',
        'title': 'Original (for reference)',
        'note': 'What is in the package now: 2.7s, 3.6px, spread over 250px.',
        'pts': [(26, 60), (68, 34), (106, 66), (148, 28), (190, 62), (230, 36), (274, 52)],
        'stroke': 3.6, 'pen': 1.0, 'baseline': False,
        'draw': 96, 'hold': 18, 'clear': 46,
        'ship': False,
    },
]


def catmull_tangents(pts):
    """Bezier in/out tangents, relative to each vertex, from a Catmull-Rom fit."""
    n = len(pts)
    out, inn = [], []
    for i in range(n):
        prev, nxt = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        tx, ty = (nxt[0] - prev[0]) / 6.0, (nxt[1] - prev[1]) / 6.0
        out.append((tx, ty))
        inn.append((-tx, -ty))
    return inn, out


def cubic(p0, c0, c1, p1, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t**3 * p1[0],
            u**3 * p0[1] + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t**3 * p1[1])


def arc_table(pts, inn, out, per_seg=60):
    samples, lengths, total = [], [], 0.0
    for i in range(len(pts) - 1):
        p0, p1 = pts[i], pts[i + 1]
        c0 = (p0[0] + out[i][0], p0[1] + out[i][1])
        c1 = (p1[0] + inn[i + 1][0], p1[1] + inn[i + 1][1])
        for k in range(per_seg + 1):
            if k == 0 and samples:
                continue
            p = cubic(p0, c0, c1, p1, k / per_seg)
            if samples:
                total += math.dist(samples[-1], p)
            samples.append(p)
            lengths.append(total)
    return samples, lengths, total


def at_distance(samples, lengths, total, frac):
    target = max(0.0, min(1.0, frac)) * total
    lo, hi = 0, len(lengths) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if lengths[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    p, q = samples[i - 1], samples[i]
    span = lengths[i] - lengths[i - 1]
    t = 0 if span == 0 else (target - lengths[i - 1]) / span
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def ease(t):
    """Gentle in/out, so the pen starts and stops like a hand rather than a motor."""
    return t * t * (3 - 2 * t)


# The pen, in local coordinates with the writing tip at the origin and the barrel going up
# and back over the writer's hand. Tapered rather than a triangle, so it reads as a pen held
# at an angle instead of a chevron.
PEN_ANGLE = math.radians(222)
PEN_LEN, PEN_SHOULDER, PEN_HALF_NIB, PEN_HALF_BARREL = 34, 9, 2.0, 3.6


def pen_shape(scale=1.0):
    ax, ay = math.cos(PEN_ANGLE), math.sin(PEN_ANGLE)
    px, py = -ay, ax
    def at(d, half):
        return (ax * d * scale + px * half * scale, ay * d * scale + py * half * scale)
    verts = [(0.0, 0.0), at(PEN_SHOULDER, PEN_HALF_NIB), at(PEN_LEN, PEN_HALF_BARREL),
             at(PEN_LEN, -PEN_HALF_BARREL), at(PEN_SHOULDER, -PEN_HALF_NIB)]
    return {'i': [[0, 0]] * len(verts), 'o': [[0, 0]] * len(verts),
            'v': [[round(x, 2), round(y, 2)] for x, y in verts], 'c': True}


def hold_easing():
    return {'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}}


def build(v):
    pts = v['pts']
    inn, out = catmull_tangents(pts)
    samples, lengths, total = arc_table(pts, inn, out)
    f_draw, f_hold, f_clear = v['draw'], v['hold'], v['clear']
    f_end = f_draw + f_hold + f_clear

    def group(shape, stroke_w, opacity=100):
        return {'ty': 'gr', 'nm': 'g', 'it': [
            {'ty': 'sh', 'nm': 'p', 'ks': {'a': 0, 'k': shape}},
            {'ty': 'st', 'nm': 's', 'c': {'a': 0, 'k': INK}, 'o': {'a': 0, 'k': opacity},
             'w': {'a': 0, 'k': stroke_w}, 'lc': 2, 'lj': 2, 'ml': 4},
            {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0]}, 'a': {'a': 0, 'k': [0, 0]},
             's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0},
             'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}},
        ]}

    layers = []

    # A faint rule for the pen to write on, so the canvas is never blank at frame 0 — which
    # is most of what made the first version feel like nothing was happening.
    if v['baseline']:
        xs = [p[0] for p in pts]
        y = max(p[1] for p in pts) + 6
        rule = {'i': [[0, 0], [0, 0]], 'o': [[0, 0], [0, 0]],
                'v': [[min(xs) - 12, y], [max(xs) + 12, y]], 'c': False}
        layers.append({
            'ddd': 0, 'ind': 3, 'ty': 4, 'nm': 'Rule', 'sr': 1,
            'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [0, 0, 0]},
                   'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
            'ao': 0, 'ip': 0, 'op': f_end, 'st': 0, 'bm': 0,
            'shapes': [group(rule, 1.5, opacity=22)],
        })

    ink_group = group({'i': [list(t) for t in inn], 'o': [list(t) for t in out],
                       'v': [list(p) for p in pts], 'c': False}, v['stroke'])
    ink_group['it'].insert(2, {
        'ty': 'tm', 'nm': 'Trim', 'm': 1,
        's': {'a': 1, 'k': [
            {'t': 0, 's': [0], **hold_easing()},
            {'t': f_draw + f_hold, 's': [0], **hold_easing()},
            {'t': f_end, 's': [100]}]},
        'e': {'a': 1, 'k': [
            {'t': 0, 's': [0], **hold_easing()},
            {'t': f_draw, 's': [100]}]},
        'o': {'a': 0, 'k': 0},
    })
    layers.append({
        'ddd': 0, 'ind': 2, 'ty': 4, 'nm': 'Ink', 'sr': 1,
        'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [0, 0, 0]},
               'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
        'ao': 0, 'ip': 0, 'op': f_end, 'st': 0, 'bm': 0, 'shapes': [ink_group],
    })

    pos_k, steps = [], 28
    for k in range(steps + 1):
        f = round(f_draw * k / steps)
        pt = at_distance(samples, lengths, total, ease(k / steps))
        kf = {'t': f, 's': [round(pt[0], 2), round(pt[1], 2), 0]}
        if k < steps:
            kf['i'], kf['o'] = {'x': 0.5, 'y': 1}, {'x': 0.5, 'y': 0}
        pos_k.append(kf)

    layers.insert(0, {
        'ddd': 0, 'ind': 1, 'ty': 4, 'nm': 'Pen', 'sr': 1,
        'ks': {
            'o': {'a': 1, 'k': [
                {'t': 0, 's': [100], **hold_easing()},
                {'t': f_draw, 's': [100], **hold_easing()},
                {'t': f_draw + f_hold, 's': [0]}]},
            'r': {'a': 0, 'k': 0}, 'p': {'a': 1, 'k': pos_k},
            'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
        'ao': 0, 'ip': 0, 'op': f_end, 'st': 0, 'bm': 0,
        'shapes': [{'ty': 'gr', 'nm': 'Pen group', 'it': [
            {'ty': 'sh', 'nm': 'Body', 'ks': {'a': 0, 'k': pen_shape(v['pen'])}},
            {'ty': 'fl', 'nm': 'Fill', 'c': {'a': 0, 'k': INK}, 'o': {'a': 0, 'k': 100}, 'r': 1},
            {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0]}, 'a': {'a': 0, 'k': [0, 0]},
             's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0},
             'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}}]}],
    })

    return {'v': '5.7.5', 'fr': FPS, 'ip': 0, 'op': f_end, 'w': W, 'h': H,
            'nm': f"TMA loading — {v['title']}", 'ddd': 0, 'assets': [],
            'layers': layers, 'markers': []}


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    return os.path.getsize(path)


want_variants = '--variants' in sys.argv
for v in VARIANTS:
    data = build(v)
    cycle = data['op'] / FPS
    if v['ship']:
        size = write(SHIP_TO, data)
        print(f"ship     {v['key']:10} {size:5} B  {cycle:.2f}s  -> {os.path.relpath(SHIP_TO, REPO)}")
    if want_variants:
        p = os.path.join(VARIANT_DIR, f"{v['key']}.json")
        size = write(p, data)
        print(f"variant  {v['key']:10} {size:5} B  {cycle:.2f}s  -> {os.path.relpath(p, REPO)}")
