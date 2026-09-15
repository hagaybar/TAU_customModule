"""Choose which candidate loading animation the TMA package ships.

One word, one place. The two generators — make-loading-animation.py (the writing pen and its
variants) and make-loading-concepts.py (stamp, cogs, tiles, blots) — only ever write into
loading-variants/. Neither touches the package. This does, and nothing else does, so there
is no way for a re-run of either generator to quietly change what ships.

    python3 docs/assets/TMA/ship-loading-animation.py

Candidates and why they exist are in README.md. The short version: a loader has to read in a
glimpse, because a spinner is often on screen for well under a second.
"""
import json
import os
import shutil

CHOSEN = 'stamp'

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(HERE, 'loading-variants', f'{CHOSEN}.json')
DST = os.path.join(REPO, 'src', 'assets', 'views', 'tma', 'images',
                   'loadingAnimations', 'LoadingAnimationJson.json')

if not os.path.exists(SRC):
    available = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, 'loading-variants'))
                       if f.endswith('.json'))
    raise SystemExit(
        f"No variant named {CHOSEN!r}. Run the generators first, or pick one of: "
        f"{', '.join(available)}")

os.makedirs(os.path.dirname(DST), exist_ok=True)
shutil.copyfile(SRC, DST)

with open(DST) as fh:
    data = json.load(fh)
print(f"shipping {CHOSEN!r}: {data['nm']}  {data['w']}x{data['h']}  "
      f"{data['op'] / data['fr']:.2f}s  {os.path.getsize(DST)} B")
print(f"  -> {os.path.relpath(DST, REPO)}")
