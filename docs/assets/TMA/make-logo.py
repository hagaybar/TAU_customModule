"""Restore the stamp brackets to Hila's TMA wordmark.

The classic Primo VE logo frames the text with two corner marks — one at the top right, one
at the bottom left — so it reads as a stamp or a registration mark rather than a line of
type. Hila's redesign changed the typeface (serif, three lines) and dropped them. This keeps
her typography and puts the corners back, in the classic's proportions.

Geometry measured off the classic file (300x56), expressed as fractions so it transfers to
this canvas: stroke ~1.3% of the width, horizontal arms ~27% of the width, vertical arms
~80% of the height, inset ~4% from the edges.

Her artwork is scaled to 84% and re-centred to make room for the brackets, so the type stays
inside the frame instead of touching it.

Writes both inks: black for the current white header, white for whenever the header is dark
again. Only the black one ships today.
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))  # docs/assets/TMA -> repo root
SRC = os.path.join(HERE, 'tma-pat-logo.png')
# Writes straight into the tma family folder; select-view.mjs copies it from there.
OUT_DIR = os.path.join(REPO, 'src', 'assets', 'views', 'tma', 'images')

W, H = 300, 73
SCALE = 0.84
STROKE = max(2, round(W * 0.013))
ARM_X = round(W * 0.27)
ARM_Y = round(H * 0.80)
INSET = round(W * 0.012)

src = Image.open(SRC).convert('RGBA')
alpha = src.getchannel('A')


def build(ink):
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # The wordmark, recoloured and scaled down to sit inside the frame.
    art = Image.new('RGBA', src.size, ink + (0,))
    art.putalpha(alpha)
    tw, th = round(src.size[0] * SCALE), round(src.size[1] * SCALE)
    art = art.resize((tw, th), Image.LANCZOS)
    canvas.alpha_composite(art, ((W - tw) // 2, (H - th) // 2))

    d = ImageDraw.Draw(canvas)
    fill = ink + (255,)
    right, bottom = W - 1 - INSET, H - 1 - INSET
    left, top = INSET, INSET

    # Top-right corner: along the top edge, then down the right edge.
    d.rectangle([right - ARM_X, top, right, top + STROKE - 1], fill=fill)
    d.rectangle([right - STROKE + 1, top, right, top + ARM_Y], fill=fill)

    # Bottom-left corner: up the left edge, then along the bottom edge.
    d.rectangle([left, bottom - ARM_Y, left + STROKE - 1, bottom], fill=fill)
    d.rectangle([left, bottom - STROKE + 1, left + ARM_X, bottom], fill=fill)

    return canvas


outputs = [
    ((0, 0, 0), os.path.join(OUT_DIR, 'library-logo.png')),
    ((0, 0, 0), os.path.join(OUT_DIR, 'library-logo-he.png')),
    ((255, 255, 255), os.path.join(HERE, 'tma-pat-logo-stamp-white.png')),
]
for ink, path in outputs:
    img = build(ink)
    img.save(path, 'PNG', optimize=True)
    print(f'{os.path.relpath(path, REPO):52} {img.size[0]}x{img.size[1]}  {os.path.getsize(path)} B')
