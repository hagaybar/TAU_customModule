"""Generate TMA's loading animation: a nib writing a line of script, then lifting.

The Primo host fetches assets/images/loadingAnimations/LoadingAnimationJson.json and plays
it while a page loads. It is a Lottie (bodymovin) file, not an SVG — the host hands it to a
Lottie player, so an SVG at that path renders nothing. NDE already ships its own here; TMA
was falling back to Ex Libris' stock dots.

Everything is generated from one path so the pen cannot drift away from the ink: the stroke
is drawn by animating a Lottie trim-path along that path, and the pen's position keyframes
are sampled from the very same curve, arc-length parameterised so it travels at an even
speed instead of hurrying through the flat parts.

The pen does not rotate. A first version turned it to face the tangent and it read as an
arrowhead skidding along a wave — because that is not what writing looks like. A hand holds
a pen at a more or less fixed attitude and moves it; only the position changes. So the pen
is drawn once at a writing angle and simply translated.

    python3 docs/assets/TMA/make-loading-animation.py

Writes the Lottie into the tma family folder and a PNG contact sheet next to this script so
the motion can be judged without a player.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT_JSON = os.path.join(REPO, 'src', 'assets', 'views', 'tma', 'images',
                        'loadingAnimations', 'LoadingAnimationJson.json')
OUT_PNG = os.path.join(HERE, 'loading-animation-preview.png')

W, H = 300, 90            # matches the canvas the host's own animation uses
FPS = 60
F_DRAW = 96               # writing
F_HOLD = 18               # the beat where the line sits complete
F_LIFT = 46               # ink retracts, ready to loop
F_END = F_DRAW + F_HOLD + F_LIFT

INK = [0.306, 0.271, 0.255, 1]     # #4e4541 — the theme's on-surface-variant brown
STROKE_W = 3.6

# A hand-written flourish. Catmull-Rom through these, so the curve is smooth without having
# to hand-tune tangents, and a tweak to one point does not break its neighbours.
PTS = [(26, 60), (68, 34), (106, 66), (148, 28), (190, 62), (230, 36), (274, 52)]


def catmull_tangents(pts):
    """Bezier in/out tangents, relative to each vertex, from a Catmull-Rom fit."""
    n = len(pts)
    out, inn = [], []
    for i, (x, y) in enumerate(pts):
        prev = pts[max(i - 1, 0)]
        nxt = pts[min(i + 1, n - 1)]
        tx, ty = (nxt[0] - prev[0]) / 6.0, (nxt[1] - prev[1]) / 6.0
        out.append((tx, ty))
        inn.append((-tx, -ty))
    return inn, out


IN_T, OUT_T = catmull_tangents(PTS)


def cubic(p0, c0, c1, p1, t):
    u = 1 - t
    return (u * u * u * p0[0] + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t * t * t * p1[0],
            u * u * u * p0[1] + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t * t * t * p1[1])


def segments():
    for i in range(len(PTS) - 1):
        p0, p1 = PTS[i], PTS[i + 1]
        c0 = (p0[0] + OUT_T[i][0], p0[1] + OUT_T[i][1])
        c1 = (p1[0] + IN_T[i + 1][0], p1[1] + IN_T[i + 1][1])
        yield p0, c0, c1, p1


def arc_table(samples_per_seg=60):
    """Dense samples with cumulative length, so progress can be mapped to distance."""
    pts, lengths, total = [], [], 0.0
    for seg in segments():
        for k in range(samples_per_seg + 1):
            if k == 0 and pts:
                continue
            p = cubic(*seg, k / samples_per_seg)
            if pts:
                total += math.dist(pts[-1], p)
            pts.append(p)
            lengths.append(total)
    return pts, lengths, total


SAMPLES, LENGTHS, TOTAL = arc_table()


def at_distance(frac):
    """Point and heading at `frac` of the way along the stroke, by arc length."""
    target = max(0.0, min(1.0, frac)) * TOTAL
    lo, hi = 0, len(LENGTHS) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if LENGTHS[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    p, q = SAMPLES[i - 1], SAMPLES[i]
    span = LENGTHS[i] - LENGTHS[i - 1]
    t = 0 if span == 0 else (target - LENGTHS[i - 1]) / span
    pt = (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
    return pt, ang


def ease(t):
    """Gentle in/out, so the nib starts and stops like a hand rather than a motor."""
    return t * t * (3 - 2 * t)


# The pen, in local coordinates with the writing tip at the origin and the barrel going up
# and back over the writer's hand. Tapered rather than a triangle, so it reads as a pen held
# at an angle instead of a chevron.
PEN_ANGLE = math.radians(222)     # up and to the left, a natural right-handed grip
PEN_LEN = 34
PEN_SHOULDER = 9                  # where the nib stops widening and the barrel begins
PEN_HALF_NIB = 2.0
PEN_HALF_BARREL = 3.6


def pen_shape():
    ax, ay = math.cos(PEN_ANGLE), math.sin(PEN_ANGLE)
    px, py = -ay, ax                       # perpendicular
    def at(d, half):
        return (ax * d + px * half, ay * d + py * half)
    verts = [
        (0.0, 0.0),                        # the writing tip
        at(PEN_SHOULDER, PEN_HALF_NIB),
        at(PEN_LEN, PEN_HALF_BARREL),
        at(PEN_LEN, -PEN_HALF_BARREL),
        at(PEN_SHOULDER, -PEN_HALF_NIB),
    ]
    return {
        'i': [[0, 0]] * len(verts),
        'o': [[0, 0]] * len(verts),
        'v': [[round(x, 2), round(y, 2)] for x, y in verts],
        'c': True,
    }


def build_lottie():
    path = {
        'i': [list(v) for v in IN_T],
        'o': [list(v) for v in OUT_T],
        'v': [list(p) for p in PTS],
        'c': False,
    }

    # Trim paths: end sweeps 0 -> 100 while writing, then start chases it to clear the line.
    trim = {
        'ty': 'tm', 'nm': 'Trim', 'm': 1,
        's': {'a': 1, 'k': [
            {'t': 0, 's': [0], 'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}},
            {'t': F_DRAW + F_HOLD, 's': [0], 'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}},
            {'t': F_END, 's': [100]},
        ]},
        'e': {'a': 1, 'k': [
            {'t': 0, 's': [0], 'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}},
            {'t': F_DRAW, 's': [100]},
        ]},
        'o': {'a': 0, 'k': 0},
    }

    ink_layer = {
        'ddd': 0, 'ind': 2, 'ty': 4, 'nm': 'Ink', 'sr': 1,
        'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [0, 0, 0]},
               'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
        'ao': 0, 'ip': 0, 'op': F_END, 'st': 0, 'bm': 0,
        'shapes': [{
            'ty': 'gr', 'nm': 'Stroke group', 'it': [
                {'ty': 'sh', 'nm': 'Script', 'ks': {'a': 0, 'k': path}},
                {'ty': 'st', 'nm': 'Stroke', 'c': {'a': 0, 'k': INK}, 'o': {'a': 0, 'k': 100},
                 'w': {'a': 0, 'k': STROKE_W}, 'lc': 2, 'lj': 2, 'ml': 4},
                trim,
                {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0]}, 'a': {'a': 0, 'k': [0, 0]},
                 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0},
                 'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}},
            ],
        }],
    }

    # The pen: sampled from the same curve, so its tip rides the leading edge exactly.
    pos_k = []
    steps = 32
    for k in range(steps + 1):
        f = round(F_DRAW * k / steps)
        pt, _ = at_distance(ease(k / steps))
        frame = {'t': f, 's': [round(pt[0], 2), round(pt[1], 2), 0]}
        if k < steps:
            frame['i'] = {'x': 0.5, 'y': 1}
            frame['o'] = {'x': 0.5, 'y': 0}
        pos_k.append(frame)

    nib_layer = {
        'ddd': 0, 'ind': 1, 'ty': 4, 'nm': 'Nib', 'sr': 1,
        'ks': {
            # Lifts off the paper once the line is written, and is gone while it clears.
            'o': {'a': 1, 'k': [
                {'t': 0, 's': [100], 'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}},
                {'t': F_DRAW, 's': [100], 'i': {'x': [0.4], 'y': [1]}, 'o': {'x': [0.6], 'y': [0]}},
                {'t': F_DRAW + F_HOLD, 's': [0]},
            ]},
            'r': {'a': 0, 'k': 0},
            'p': {'a': 1, 'k': pos_k},
            'a': {'a': 0, 'k': [0, 0, 0]},
            's': {'a': 0, 'k': [100, 100, 100]},
        },
        'ao': 0, 'ip': 0, 'op': F_END, 'st': 0, 'bm': 0,
        'shapes': [{
            'ty': 'gr', 'nm': 'Nib group', 'it': [
                {'ty': 'sh', 'nm': 'Pen body', 'ks': {'a': 0, 'k': pen_shape()}},
                {'ty': 'fl', 'nm': 'Nib fill', 'c': {'a': 0, 'k': INK}, 'o': {'a': 0, 'k': 100}, 'r': 1},
                {'ty': 'tr', 'p': {'a': 0, 'k': [0, 0]}, 'a': {'a': 0, 'k': [0, 0]},
                 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0},
                 'o': {'a': 0, 'k': 100}, 'sk': {'a': 0, 'k': 0}, 'sa': {'a': 0, 'k': 0}},
            ],
        }],
    }

    return {
        'v': '5.7.5', 'fr': FPS, 'ip': 0, 'op': F_END, 'w': W, 'h': H,
        'nm': 'TMA loading — nib writing', 'ddd': 0, 'assets': [],
        'layers': [nib_layer, ink_layer], 'markers': [],
    }


def write_preview():
    from PIL import Image, ImageDraw
    fracs = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    pad = 10
    sheet = Image.new('RGB', (W + pad * 2, (H + pad) * len(fracs) + pad), (255, 255, 255))
    for row, f in enumerate(fracs):
        tile = Image.new('RGBA', (W * 4, H * 4), (255, 255, 255, 255))
        d = ImageDraw.Draw(tile)
        ink = tuple(round(c * 255) for c in INK[:3])
        upto = [(x * 4, y * 4) for (x, y), L in zip(SAMPLES, LENGTHS) if L <= f * TOTAL]
        if len(upto) > 1:
            d.line(upto, fill=ink, width=round(STROKE_W * 4), joint='curve')
        if 0 < f < 1:
            (px, py), _ = at_distance(f)
            poly = [((px + vx) * 4, (py + vy) * 4) for vx, vy in pen_shape()['v']]
            d.polygon(poly, fill=ink)
        sheet.paste(tile.resize((W, H), Image.LANCZOS), (pad, pad + row * (H + pad)))
    sheet.save(OUT_PNG)
    print(f'{os.path.relpath(OUT_PNG, REPO)}  progress 0 / 20 / 40 / 60 / 80 / 100%')


os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
data = build_lottie()
with open(OUT_JSON, 'w') as fh:
    json.dump(data, fh, separators=(',', ':'))
print(f'{os.path.relpath(OUT_JSON, REPO)}  {os.path.getsize(OUT_JSON)} B  '
      f'{W}x{H}  {FPS}fps  {F_END} frames ({F_END / FPS:.1f}s)')
write_preview()
