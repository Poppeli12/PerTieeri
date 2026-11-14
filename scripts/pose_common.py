"""Yhteiset apurit Per Tieerin asentokuvien käsittelyyn (normalisointi samaan koordinaatistoon)."""
import numpy as np
from PIL import Image

POSES = ['ristissa', 'vilkuttaa', 'tervetuloa', 'sivuilla']
H = 525.0  # yhteinen korkeus: lakin yläreuna 0 → kengänpohja H
VB_W = 340.0  # yhteinen leveys (tervetuloa-asennon kämmenet mahtuvat)
CX = VB_W / 2  # pään keskilinja


def load_ink(path):
    """Muste 0..1: tummuus × vihreys (harmaat kuvakaappausjäänteet ja napit eivät ole mustetta)."""
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    dark = np.clip((248 - g) / 160.0, 0, 1)
    greenish = np.clip(((g - r) - 6) / 18.0, 0, 1)
    ink = dark * greenish
    return ink, a


def frame(ink):
    """Lakin yläreuna, kengänpohja ja pään keskilinja (lakin leveimmän kohdan keskikohta)."""
    rows = np.where((ink > 0.35).sum(axis=1) >= 2)[0]
    top, bot = rows[0], rows[-1]
    h = bot - top
    cap = ink[top: top + int(h * 0.07)] > 0.35
    cols = np.where(cap.any(axis=0))[0]
    cx = (cols[0] + cols[-1]) / 2
    return top, bot, cx


def normalize(path, scale_px=4):
    """Palauttaa musteen normalisoituna yhteiseen koordinaatistoon (VB_W × H) kertoimella scale_px."""
    ink, _ = load_ink(path)
    top, bot, cx = frame(ink)
    s = H / (bot - top)  # alkuperäinen px → viewBox
    out_w, out_h = int(VB_W * scale_px), int((H + 6) * scale_px)
    # affiininen kuvaus: x' = (x - cx) * s + CX, y' = (y - top) * s
    import cv2

    M = np.array([[s * scale_px, 0, (CX - cx * s) * scale_px], [0, s * scale_px, (-top * s + 1) * scale_px]], np.float32)
    big = cv2.warpAffine(ink, M, (out_w, out_h), flags=cv2.INTER_CUBIC, borderValue=0)
    return np.clip(big, 0, 1), s
