"""Gera assets/icone.png e assets/icone.ico (rode uma vez: python make_icon.py)."""
from pathlib import Path

from PIL import Image, ImageDraw

LARANJA = (189, 72, 12, 255)
CREME = (255, 244, 217, 255)
BRANCO = (255, 255, 255, 255)


def desenhar(tam: int = 512) -> Image.Image:
    img = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = tam * 0.04
    d.rounded_rectangle([m, m, tam - m, tam - m], radius=tam * 0.22, fill=LARANJA)
    # três barras crescendo + ponto (vendas subindo)
    base = tam * 0.74
    larg = tam * 0.13
    xs = [tam * 0.24, tam * 0.435, tam * 0.63]
    alturas = [0.20, 0.33, 0.46]
    for x, h in zip(xs, alturas):
        d.rounded_rectangle([x, base - tam * h, x + larg, base], radius=larg * 0.3, fill=BRANCO)
    r = tam * 0.065
    cx, cy = xs[2] + larg / 2, base - tam * alturas[2] - tam * 0.12
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CREME)
    return img


if __name__ == "__main__":
    pasta = Path(__file__).parent / "assets"
    pasta.mkdir(exist_ok=True)
    img = desenhar()
    img.resize((256, 256), Image.LANCZOS).save(pasta / "icone.png")
    img.save(pasta / "icone.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("ok")
