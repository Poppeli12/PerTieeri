"""
Per Tieerin 20 tunnetila-asentoa → src/components/perTieeriEmotions.ts

Ajo:  python scripts/vectorize-emotions.py

Lähteet: design/reference/hahmo/tunteet/*.png (käyttäjän piirrokset).
- Jokainen kuva normalisoidaan perusasennon (perTieeriPoses.ts) koordinaatistoon: kengänpohja y = 525,
  vartalon keskilinja x = 170, mittakaava = hahmon korkeus lakista kenkiin (asennoissa, joissa kädet tai
  merkit ovat lakin yläpuolella, käytetään muiden asentojen mediaanimittakaavaa).
- Kuvakaappausten käyttöliittymäjäänteet (harmaat napit, sivupalkin pienoiskuvat) poistetaan:
  muste = vihreä ja tumma, ja vain hahmon lähellä olevat komponentit säilytetään.
- Jokainen asento on yksi kerros (valkoinen siluetti + viivat) – animaatio tehdään koko asennolle.
"""
import glob
import os
import sys

import cv2
import numpy as np
from scipy import ndimage

sys.path.insert(0, 'scripts')
from pose_common import CX, H, VB_W, load_ink  # noqa: E402

SRC = 'design/reference/hahmo/tunteet'
OUT = 'src/components/perTieeriEmotions.ts'
Z = 4
EPS = 1.15
# asennot, joissa jotain on lakin yläpuolella → mittakaava mediaanista
ABOVE_CAP = {'innostunut': 'nauraa'}
# nojaavat asennot ovat luonnostaan matalampia: lakki–kengät-korkeus suhteessa seisovaan
HEIGHT = {'kuiskaa': 0.86, 'osoittaa': 0.94}  # kädet lakin yläpuolella → mittakaava viereisestä samalla zoomilla otetusta kuvasta


def components(ink):
    m = (ink > 0.35).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    x, y, w, h = st[big, :4]
    keep = np.zeros(n, bool)
    keep[big] = True
    for i in range(1, n):
        cx = st[i, 0] + st[i, 2] / 2
        cy = st[i, 1] + st[i, 3] / 2
        near_head = cy <= y + 0.28 * h and x - 0.12 * w <= cx <= x + 1.12 * w  # ?, ! ja liikeviivat pään ympärillä
        inside = x <= cx <= x + w and y <= cy <= y + h
        if (near_head or inside) and st[i, cv2.CC_STAT_AREA] > 3 and st[i, cv2.CC_STAT_HEIGHT] < 0.2 * h:
            keep[i] = True
    return keep[lab], (x, y, w, h)


raw = {}
for f in sorted(glob.glob(f'{SRC}/*.png')):
    name = os.path.splitext(os.path.basename(f))[0]
    ink, _ = load_ink(f)
    ink[int(ink.shape[0] * 0.93):, :] *= 0  # alareunan "Muokkaa"-palkki ja varjo
    keep, (x, y, w, h) = components(ink)
    ink = ink * keep
    rows = np.where((ink > 0.35).any(axis=1))[0]
    bot = rows[-1]
    feet = ink[bot - int(h * 0.08): bot + 1] > 0.35
    fc = np.where(feet.any(axis=0))[0]
    raw[name] = dict(ink=ink, top=y, bot=bot, cx=(fc[0] + fc[-1]) / 2)

scales = {n: H * HEIGHT.get(n, 1.0) / (r['bot'] - r['top']) for n, r in raw.items() if n not in ABOVE_CAP}
for n, ref in ABOVE_CAP.items():
    scales[n] = scales[ref] * (raw[ref]['ink'].shape[0] / raw[n]['ink'].shape[0])
med = float(np.median(list(scales.values())))


# ---- liikkuvat osat asennoittain (kuvan koordinaatit 340 × 531, ks. design/reference/hahmo/tunteet) ----
# kind = liike (toteutus PerTieeri.tsx: PART_MOTION), pivot = nivelpiste
PARTS = {
    'esittelee': [('gesture', (0, 115, 88, 205), (88, 182)), ('gestureR', (252, 115, 340, 205), (252, 182))],
    'tervetuloa': [('gesture', (28, 192, 104, 262), (106, 192)), ('gestureR', (242, 192, 312, 262), (240, 192))],
    'hammentynyt': [('bob', (194, 0, 242, 54), (216, 52)), ('scratch', (90, 32, 136, 92), (108, 120)), ('gestureR', (238, 138, 312, 202), (246, 196))],
    'mietteliaas': [('bob', (198, 4, 252, 74), (224, 72)), ('scratch', (96, 28, 142, 82), (112, 110))],
    'huolestunut': [('head', (124, 0, 242, 98), (182, 100)), ('tremble', (100, 276, 145, 322), (122, 280)), ('tremble', (190, 276, 240, 322), (214, 280))],
    'huomio': [('flicker', (228, 0, 282, 60), (255, 30)), ('point', (248, 94, 332, 168), (270, 190))],
    'innostunut': [('wave', (8, 38, 106, 116), (106, 116)), ('waveR', (238, 38, 336, 116), (238, 116)), ('flicker', (78, 16, 120, 72), (99, 44)), ('flicker', (218, 16, 260, 80), (239, 48))],
    'kuiskaa': [('flicker', (292, 116, 338, 168), (315, 142))],
    'liikuttunut': [('pat', (158, 128, 232, 198), (195, 200)), ('gestureR', (238, 266, 318, 318), (248, 280))],
    'narkastynyt': [('tap', (182, 438, 282, 531), (205, 505)), ('flicker', (188, 18, 232, 64), (210, 41))],
    'nauraa': [('headFast', (126, 0, 218, 112), (170, 112)), ('gesture', (18, 104, 98, 197), (96, 170)), ('gestureR', (242, 104, 328, 197), (244, 170))],
    'nolo': [('head', (138, 0, 268, 114), (196, 116))],
    'osoittaa': [('point', (284, 132, 340, 242), (300, 250))],
    'sivuilla': [('swingL', (68, 282, 122, 352), (100, 200)), ('swingR', (222, 282, 272, 352), (246, 200))],
    'surullinen': [('head', (108, 0, 212, 110), (165, 112))],
    'vihainen': [('headFast', (118, 0, 218, 114), (168, 116)), ('tremble', (52, 242, 118, 308), (85, 250)), ('tremble', (220, 242, 282, 308), (250, 250))],
    'vilkuttaa-iloisesti': [('wave', (38, 22, 128, 136), (84, 136))],
    'vilkuttaa': [('wave', (38, 30, 118, 118), (80, 122))],
    'yllattynyt': [('shiver', (58, 82, 132, 168), (100, 172)), ('shiverR', (236, 82, 318, 168), (255, 172)), ('flicker', (92, 16, 130, 80), (110, 46)), ('flicker', (222, 16, 262, 80), (240, 46))],
}


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'


def path_of(mask):
    out = ''
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c) < Z * Z * 0.3 and len(c) < 12:
            continue
        ap = cv2.approxPolyDP(c.astype(np.float32), EPS, True)[:, 0, :] / Z
        if len(ap) < 3:
            continue
        n = len(ap)
        mids = [(ap[i] + ap[(i + 1) % n]) / 2 for i in range(n)]
        out += 'M%s %s' % (fmt(mids[-1][0]), fmt(mids[-1][1]))
        for i in range(n):
            out += 'Q%s %s %s %s' % (fmt(ap[i][0]), fmt(ap[i][1]), fmt(mids[i][0]), fmt(mids[i][1]))
        out += 'Z'
    return out


res = {}
heads = {}
part_paths = {}
for name, r in raw.items():
    s = scales.get(name, med)
    M = np.array([[s * Z, 0, (CX - r['cx'] * s) * Z], [0, s * Z, (H - r['bot'] * s) * Z]], np.float32)
    big = cv2.warpAffine(r['ink'], M, (int(VB_W * Z), int((H + 6) * Z)), flags=cv2.INTER_CUBIC, borderValue=0)
    big = cv2.GaussianBlur(np.clip(big, 0, 1), (0, 0), Z * 0.2)
    k = int(Z * 3.2) | 1
    lm = cv2.dilate(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    mask = ((big / np.maximum(lm, 0.3) > 0.5) & (big > 0.14)).astype(np.uint8)
    sil = cv2.dilate(ndimage.binary_fill_holes(mask).astype(np.uint8), np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(sil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    sm = np.zeros_like(sil)
    for c in cs:
        if cv2.contourArea(c) > Z * Z * 40:
            cv2.drawContours(sm, [c], -1, 1, -1)
    sil_path = path_of(sm)
    # pään sijainti: lakki on ylhäältä katsottuna ensimmäinen vähintään 44 yksikön levyinen yhtenäinen kohta
    hx = hy = None
    for yy in range(sm.shape[0]):
        row = sm[yy]
        if not row.any():
            continue
        xs = np.where(row)[0]
        splits = np.where(np.diff(xs) > 1)[0]
        starts = np.r_[xs[0], xs[splits + 1]]
        ends = np.r_[xs[splits], xs[-1]]
        i = int(np.argmax(ends - starts))
        if (ends[i] - starts[i]) / Z >= 44:
            hx, hy = (starts[i] + ends[i]) / 2 / Z, yy / Z - 12
            break
    heads[name] = (round(hx, 1), round(max(0, hy), 1))
    parts = []
    rest = mask.copy()
    for kind, (x0, y0, x1, y1), (px, py) in PARTS.get(name, []):
        pm = np.zeros_like(mask)
        pm[int(y0 * Z):int(y1 * Z), int(x0 * Z):int(x1 * Z)] = 1
        pm &= rest
        rest &= 1 - pm
        parts.append((kind, path_of(pm), px, py))
    part_paths[name] = parts
    res[name] = (sil_path, path_of(rest))
    print(name, 'scale', round(s, 3), 'chars', len(res[name][0]) + len(res[name][1]))

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// GENEROITU – älä muokkaa käsin. Lähteet: design/reference/hahmo/tunteet/*.png\n')
    f.write('// Luo uudelleen: python scripts/vectorize-emotions.py\n\n')
    f.write('export type EmotionName =\n' + '\n'.join(f"  | '{n}'" for n in res) + ';\n\n')
    f.write('/** pään (lakin) keskikohta x ja lakin yläreuna y – kasvokuvan keskitykseen */\n')
    f.write('export const PT_EMOTION_HEAD: Record<EmotionName, { x: number; y: number }> = {\n')
    for n, (hx, hy) in heads.items():
        f.write(f"  '{n}': {{ x: {hx}, y: {hy} }},\n")
    f.write('};\n\n')
    f.write('/** liikkuvat osat: kind = liike (PerTieeri.tsx), px/py = nivelpiste */\n')
    f.write("export type PartKind = 'gesture' | 'gestureR' | 'bob' | 'scratch' | 'head' | 'headFast' | 'tremble' | 'flicker' | 'point' | 'wave' | 'waveR' | 'pat' | 'tap' | 'swingL' | 'swingR' | 'shiver' | 'shiverR';\n")
    f.write('export const PT_EMOTION_PARTS: Record<EmotionName, { kind: PartKind; d: string; px: number; py: number }[]> = {\n')
    for n in res:
        f.write(f"  '{n}': [\n")
        for kind, d, px, py in part_paths.get(n, []):
            f.write(f"    {{ kind: '{kind}', px: {px}, py: {py}, d: '{d}' }},\n")
        f.write('  ],\n')
    f.write('};\n\n')
    f.write('/** sama koordinaatisto kuin perTieeriPoses.ts (PT_W × PT_H) */\n')
    f.write('export const PT_EMOTIONS: Record<EmotionName, { sil: string; ink: string }> = {\n')
    for n, (a, b) in res.items():
        f.write(f"  '{n}': {{\n    sil: '{a}',\n    ink: '{b}',\n  }},\n")
    f.write('};\n')
print('median scale', round(med, 3), 'total KB', os.path.getsize(OUT) // 1024)
