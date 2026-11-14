"""
Per Tieerin neljä asentoa → src/components/perTieeriPoses.ts

Ajo:  python scripts/vectorize-poses.py

Lähteet: design/reference/hahmo/{ristissa,vilkuttaa,tervetuloa,sivuilla}.png
1. Jokainen kuva normalisoidaan samaan koordinaatistoon (pose_common.normalize): lakin yläreuna,
   kengänpohja ja pään keskilinja osuvat kaikissa asennoissa samaan kohtaan → pää on yhteinen,
   joten ilmeet ja pään liike jatkuvat saumattomasti asennosta toiseen.
2. Muste jäljitetään paikallisesti normalisoiden (jokainen viiva puolen huipun kohdalta = oikea paksuus).
3. Muste jaetaan animointikerroksiin alueittain (pää, silmät, viikset, vartalo + asentokohtainen lisä:
   ristissä = kädet hierontaan, vilkuttaa = kämmen ranteesta kääntyväksi).
4. Ääriviivat → pehmeät neliölliset Bézier-käyrät, täyttösääntö evenodd. Lisäksi valkoinen siluetti.
"""
import sys

import cv2
import numpy as np
from scipy import ndimage

sys.path.insert(0, 'scripts')
from pose_common import CX, H, VB_W, normalize  # noqa: E402

# vain perusasento (kädet ristissä) kerroksittain; muut asennot: vectorize-emotions.py
POSES = ['ristissa']

OUT = 'src/components/perTieeriPoses.ts'
Z = 8  # raster px per viewBox-yksikkö
EPS = 1.5

# ---- alueet viewBox-koordinaateissa (ks. design/reference/hahmo/LUE.md) ----
HEAD = [(0, 0), (VB_W, 0), (VB_W, 91), (193, 91), (189, 99.5), (151, 99.5), (147, 91), (0, 91)]
EYES = [[(148, 55.5), (164.5, 55.5), (164.5, 64.5), (148, 64.5)], [(175.5, 55.5), (192, 55.5), (192, 64.5), (175.5, 64.5)]]
STACHE = [(143, 69.5), (197, 69.5), (197, 80.6), (143, 80.6)]
EXTRA = {
    'ristissa': [(150, 236), (165, 227), (196, 227), (208, 250), (201, 268), (170, 273), (149, 263)],  # ristityt kädet
    'vilkuttaa': [(48, 60), (103.5, 60), (103.5, 119.5), (52, 119.5)],  # vilkuttava kämmen (ranteen yläpuolelta)
}
PIVOT = {
    'neck': (CX, 97),
    'eyes_y': 60,
    'eyeL': 156,
    'eyeR': 183.5,
    'stache': (CX, 72),
    'mouth': (CX, 84),
    'hands': (178, 250),
    'wrist': (78, 124),
}


def poly_mask(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array([[x * Z, y * Z] for x, y in pts], np.int32)], 1)
    return m


def trace(ink_big):
    big = cv2.GaussianBlur(ink_big, (0, 0), Z * 0.2)
    k = int(Z * 3.2) | 1
    localmax = cv2.dilate(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    norm = big / np.maximum(localmax, 0.30)
    mask = ((norm > 0.5) & (big > 0.14)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < Z * Z * 0.8:
            mask[lab == i] = 0
    return mask


def fmt(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'


def contour_path(c):
    c = c[:, 0, :].astype(np.float32)
    if len(c) < 3:
        return ''
    ap = cv2.approxPolyDP(c.reshape(-1, 1, 2), EPS, True)[:, 0, :]
    if len(ap) < 3:
        return ''
    p = ap / Z
    n = len(p)
    mids = [(p[i] + p[(i + 1) % n]) / 2 for i in range(n)]
    d = 'M%s %s' % (fmt(mids[-1][0]), fmt(mids[-1][1]))
    for i in range(n):
        d += 'Q%s %s %s %s' % (fmt(p[i][0]), fmt(p[i][1]), fmt(mids[i][0]), fmt(mids[i][1]))
    return d + 'Z'


def layer_path(m):
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    return ''.join(contour_path(c) for c in cs if cv2.contourArea(c) > Z * Z * 0.25 or len(c) > 12)


out = {}
for pose in POSES:
    big, _ = normalize(f'design/reference/hahmo/{pose}.png', scale_px=Z)
    big[int((H - 2) * Z):, :] = np.where(big[int((H - 2) * Z):, :] > 0.6, big[int((H - 2) * Z):, :], 0)
    mask = trace(big)
    shp = mask.shape
    head = poly_mask(shp, HEAD)
    eyes = poly_mask(shp, EYES[0]) | poly_mask(shp, EYES[1])
    stache = poly_mask(shp, STACHE) & (1 - eyes)
    extra = poly_mask(shp, EXTRA[pose]) if pose in EXTRA else np.zeros(shp, np.uint8)
    extra &= 1 - head
    layers = {
        'body': mask & (1 - head) & (1 - extra),
        'extra': mask & extra,
        'head': mask & head & (1 - eyes) & (1 - stache),
        'eyes': mask & head & eyes,
        'stache': mask & head & stache,
    }
    res = {k: layer_path(v) for k, v in layers.items()}
    sil = ndimage.binary_fill_holes(mask).astype(np.uint8)
    sil = cv2.dilate(sil, np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(sil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    res['silhouette'] = ''.join(contour_path(c) for c in cs if cv2.contourArea(c) > Z * Z * 20)
    out[pose] = res
    print(pose, {k: len(v) for k, v in res.items()})

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// GENEROITU – älä muokkaa käsin. Lähteet: design/reference/hahmo/*.png\n')
    f.write('// Luo uudelleen: python scripts/vectorize-poses.py\n\n')
    f.write('export type PoseName = ' + ' | '.join("'%s'" % p for p in POSES) + ';\n')
    f.write('export const PT_W = %s;\nexport const PT_H = %s;\n' % (fmt(VB_W), fmt(H + 6)))
    f.write("export const PT_INK = '#175636';\n")
    f.write('/** nivelpisteet viewBox-koordinaateissa (sama kaikissa asennoissa) */\n')
    f.write('export const PT_PIVOT = {\n')
    f.write('  neck: { x: %s, y: %s },\n' % tuple(fmt(v) for v in PIVOT['neck']))
    f.write('  eyes: { y: %s },\n' % fmt(PIVOT['eyes_y']))
    f.write('  eyeL: { x: %s },\n  eyeR: { x: %s },\n' % (fmt(PIVOT['eyeL']), fmt(PIVOT['eyeR'])))
    f.write('  stache: { x: %s, y: %s },\n' % tuple(fmt(v) for v in PIVOT['stache']))
    f.write('  mouth: { x: %s, y: %s },\n' % tuple(fmt(v) for v in PIVOT['mouth']))
    f.write('  hands: { x: %s, y: %s },\n' % tuple(fmt(v) for v in PIVOT['hands']))
    f.write('  wrist: { x: %s, y: %s },\n' % tuple(fmt(v) for v in PIVOT['wrist']))
    f.write('};\n\n')
    f.write('type Layers = { silhouette: string; body: string; extra: string; head: string; eyes: string; stache: string };\n')
    f.write('export const PT_POSES: Record<PoseName, Layers> = {\n')
    for pose in POSES:
        f.write('  %s: {\n' % pose)
        for k in ['silhouette', 'body', 'extra', 'head', 'eyes', 'stache']:
            f.write("    %s: '%s',\n" % (k, out[pose][k]))
        f.write('  },\n')
    f.write('};\n')
