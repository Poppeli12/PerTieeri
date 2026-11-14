"""Siivoaa kuvitukset (design/reference/kuvitukset/*.png) sovellukseen (assets/per-tieeri/*.png):
- vaalea minttu-/valkoinen tausta läpinäkyväksi (reunoista täyttäen + suljetut minttualueet)
- esikatselun harmaa "Esikatselu"-merkki pois
- rajaus sisällön ympärille

Käyttö: python scripts/clean-illustrations.py nimi1 nimi2 ...
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SRC = 'design/reference/kuvitukset'
DST = 'assets/per-tieeri'


def clean(name: str):
    im = np.asarray(Image.open(f'{SRC}/{name}.png').convert('RGB')).astype(int)
    h, w, _ = im.shape
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mn, mx = im.min(axis=2), im.max(axis=2)
    bgish = (mn >= 224) & (mx - mn <= 24)
    # "Esikatselu"-merkki: harmaa pilleri ylhäällä oikealla
    gray = (mx - mn <= 16) & (mx >= 150) & (mx < 232)
    region = np.zeros_like(gray)
    region[:60, w - 200:] = gray[:60, w - 200:]
    from scipy import ndimage
    lab, n = ndimage.label(region)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) > 200:  # iso harmaa pilleri (ei reunojen sävykohinaa)
            bgish[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5] = True
    # täyttö reunoista
    mask = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bgish[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bgish[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bgish[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                q.append((ny, nx))
    # suljetut vaaleat taustat (kehyksen sisus ym.) myös läpinäkyviksi; pienet kohinapisteet pois
    mask |= bgish
    from scipy import ndimage
    mask = ndimage.binary_closing(np.pad(mask, 2, constant_values=True), iterations=1)[2:-2, 2:-2]
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.fromarray(im.astype(np.uint8)).convert('RGBA')
    out.putalpha(alpha)
    a = np.asarray(alpha)
    ys, xs = np.where(a > 40)
    m = 6
    box = (max(0, xs.min() - m), max(0, ys.min() - m), min(w, xs.max() + m + 1), min(h, ys.max() + m + 1))
    out = out.crop(box)
    out.save(f'{DST}/{name}.png', optimize=True)
    print(name, out.size)


for n in sys.argv[1:]:
    clean(n)
