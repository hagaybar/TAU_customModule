"""Generate 'ring-orbit-brown': NDE's ring-orbit loader recoloured to TMA's brown theme.

    python3 docs/assets/TMA/make-loading-ring-orbit.py

Same motion, same timing, same canvas as the animation NDE ships — only the two colours change,
so the two views share one loader and differ only in palette. Like the other generators it
writes into loading-variants/ and never touches the package; ship-loading-animation.py does.

The source is the NDE package's own file, read at run time, so a later change to the NDE motion
carries over on a re-run instead of drifting from a frozen copy.

── Colour mapping ──────────────────────────────────────────────────────────────────────

NDE's ring orbit is a dark mark orbiting inside a lighter ring and diamond:

  role                    NDE                  TMA
  orbiting dot (dark)     #003b7e navy         #4e4541  --sys-on-surface-variant, the warm dark
                                                         brown TMA already uses for headings,
                                                         the footer and its previous loader
  ring + diamond (light)  #66bff1 azure        #a8968c  a mid tan

The light colour is not a theme token. Tried on white beside NDE (2026-10-06):
  #807570 --sys-outline          too close to the dot; the two read as one colour
  #d4c3bb --sys-inverse-primary  the ring nearly vanishes on the white spinner dialog
  #a8968c                        between those two; keeps NDE's dark-dot / lighter-ring contrast
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(REPO, 'src', 'assets', 'views', 'nde', 'images',
                   'loadingAnimations', 'LoadingAnimationJson.json')
DST = os.path.join(HERE, 'loading-variants', 'ring-orbit-brown.json')

NDE_DARK = '#003b7e'
NDE_LIGHT = '#66bff1'
TMA_DARK = '#4e4541'
TMA_LIGHT = '#a8968c'


def rgba(hex_):
    n = int(hex_[1:], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]


def same(a, b):
    return len(a) == len(b) and all(abs(x - y) < 1e-3 for x, y in zip(a, b))


SWAP = [(rgba(NDE_DARK), rgba(TMA_DARK)), (rgba(NDE_LIGHT), rgba(TMA_LIGHT))]

with open(SRC) as fh:
    data = json.load(fh)

swapped = 0
unknown = []


def walk(node):
    global swapped
    if isinstance(node, dict):
        if node.get('ty') in ('fl', 'st') and 'c' in node:
            colour = node['c']['k']
            for old, new in SWAP:
                if same(colour, old):
                    node['c']['k'] = [round(v, 4) for v in new]
                    swapped += 1
                    break
            else:
                unknown.append(colour)
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for value in node:
            walk(value)


walk(data)

# Every colour must be accounted for: an unmapped one would ship NDE blue inside the TMA loader.
if unknown or swapped == 0:
    raise SystemExit(f"unmapped colours in the NDE source: {unknown} (swapped {swapped})")

data['nm'] = 'TMA loading — ring orbit (brown)'
os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, 'w') as fh:
    json.dump(data, fh, separators=(',', ':'))
print(f"wrote {os.path.relpath(DST, REPO)}: {swapped} colours swapped, "
      f"{data['op'] / data['fr']:.2f}s, {os.path.getsize(DST)} B")
