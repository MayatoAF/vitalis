"""Gera os ícones do PWA (Vitalis) — sem dependências externas além de Pillow.

Uso: python scripts/make_icons.py
Saída: public/icons/*.png
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")
SS = 4  # supersampling
BASE = 512


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def background(size: int) -> Image.Image:
    h = w = size
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]

    top = np.array(hex_rgb("#0d1a30"), dtype=float)
    bottom = np.array(hex_rgb("#05070f"), dtype=float)
    base = bottom + (top - bottom) * (1 - y)  # topo mais claro, shape (h, 3)
    arr = np.repeat(base[:, None, :], w, axis=1).astype(float)

    # Glow radial superior-direito (ciano) e inferior-esquerdo (menta)
    def glow(cx: float, cy: float, radius: float, color: str, strength: float):
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / radius
        falloff = np.clip(1 - d, 0, 1) ** 2.2 * strength
        c = np.array(hex_rgb(color), dtype=float)
        return c * falloff[:, :, None]

    arr += glow(0.86, 0.1, 0.75, "#1c6f8c", 0.55)
    arr += glow(0.12, 0.92, 0.8, "#12806a", 0.4)

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB").convert("RGBA")

    # Vinheta suave
    vig = Image.new("L", (w, h), 0)
    dv = ImageDraw.Draw(vig)
    for i in range(40):
        t = i / 40
        dv.ellipse(
            [(-w * 0.25) + w * 0.25 * t, (-h * 0.25) + h * 0.25 * t,
             w * 1.25 - w * 0.25 * t, h * 1.25 - h * 0.25 * t],
            outline=int(255 * (1 - t) * 0.0),
        )
    return img


def draw_mark(img: Image.Image, padding: float = 0.0) -> Image.Image:
    """Anel gradiente + linha de pulso, centralizados."""
    size = img.size[0]
    d = ImageDraw.Draw(img)
    scale = 1 - padding * 2
    cx = cy = size / 2
    r = size * 0.285 * scale
    width = int(size * 0.062 * scale)
    start, end = -55, 235

    mint = hex_rgb("#2fe0b0")
    cyan = hex_rgb("#4cc9f0")

    # Segmentos do arco com gradiente
    seg = 1.2
    a = start
    while a < end:
        t0 = (a - start) / (end - start)
        t1 = (min(a + seg, end) - start) / (end - start)
        color = lerp(mint, cyan, (t0 + t1) / 2)
        d.arc(
            [cx - r, cy - r, cx + r, cy + r],
            start=a,
            end=a + seg + 0.6,
            fill=color + (255,),
            width=width,
        )
        a += seg

    # Brilho interior
    inner = Image.new("RGBA", img.size, (0, 0, 0, 0))
    di = ImageDraw.Draw(inner)
    ir = r * 0.82
    di.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(47, 224, 176, 20))
    img.alpha_composite(inner)

    # Linha de pulso (ECG)
    pts_unit = [
        (-0.30, 0.00), (-0.15, 0.00), (-0.09, -0.17), (-0.02, 0.22),
        (0.05, -0.10), (0.11, 0.00), (0.30, 0.00),
    ]
    k = size * 0.62 * scale
    pts = [(cx + px * k, cy + py * k) for px, py in pts_unit]
    lw = int(size * 0.052 * scale)

    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.line(pts, fill=(180, 255, 235, 90), width=lw * 3, joint="curve")
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(size * 0.018))
    img.alpha_composite(glow)
    d.line(pts, fill=(238, 248, 255, 255), width=lw, joint="curve")
    d.ellipse([pts[-1][0] - lw * 0.7, pts[-1][1] - lw * 0.7,
               pts[-1][0] + lw * 0.7, pts[-1][1] + lw * 0.7], fill=(238, 248, 255, 255))
    return img


def rounded_mask(size: int, radius_ratio: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def build(with_rounding: bool, padding: float, out_size: int) -> Image.Image:
    big = BASE * SS
    img = background(big)
    img = draw_mark(img, padding)
    if with_rounding:
        img.putalpha(rounded_mask(big, 0.22))
    return img.resize((out_size, out_size), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    build(True, 0.0, 192).save(os.path.join(OUT, "icon-192.png"))
    build(True, 0.0, 512).save(os.path.join(OUT, "icon-512.png"))
    build(False, 0.12, 512).save(os.path.join(OUT, "icon-maskable-512.png"))
    build(True, 0.06, 180).save(os.path.join(OUT, "apple-touch-icon-180.png"))
    # Favicon PNG de fallback para navegadores antigos
    build(True, 0.0, 64).save(os.path.join(OUT, "favicon-64.png"))
    print("Ícones gerados em", OUT)


if __name__ == "__main__":
    main()
