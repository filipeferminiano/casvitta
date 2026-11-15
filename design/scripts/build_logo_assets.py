# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools", "brotli", "pillow", "resvg-py"]
# ///
"""Build the Casvitta logo assets into packages/ui/assets.

Sources:
  - design/logo-mark.svg            approved mark (option A, "Casa aberta")
  - design/logo-board-option-a.png  approved presentation board (raster lockups are cropped from it)
  - Familjen Grotesk Bold (OFL), downloaded from google/fonts, for the outlined wordmark

Run from the repo root:  uv run design/scripts/build_logo_assets.py
"""

from __future__ import annotations

import base64
import io
import tempfile
import urllib.request
from pathlib import Path

import resvg_py
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "packages/ui/assets"
BOARD = ROOT / "design/logo-board-option-a.png"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/familjengrotesk/FamiljenGrotesk%5Bwght%5D.ttf"

INK = (15, 30, 61)  # ink-900
YELLOW = (242, 178, 58)  # yellow-400
WHITE = (255, 255, 255)

# Measurements taken from the approved board (light lockup, px at 1x).
BOARD_LIGHT_BOX = (175, 338, 616, 405)
BOARD_DARK_BOX = (861, 352, 1115, 391)
CAP_PX = 51.0  # cap height of the wordmark
WORDMARK_W = 342.0  # ink width of "CASVITTA"
TEXT_X = 99.0  # wordmark left edge, relative to the mark's left edge
BASELINE_Y = 63.0
MARK_SCALE = 0.885  # px per mark viewBox unit
MARK_EXTENT = 66.5  # rendered mark height in px

MARK_PATH = "M82 44 L50 17 L18 44 L18 84 L82 84"


def unmix(im: Image.Image, box: tuple[int, int, int, int], bg: tuple[int, int, int],
          fgs: list[tuple[int, int, int]], pad: int) -> Image.Image:
    """Crop a region and recover a transparent image by unmixing each pixel from a flat background."""
    x0, y0, x1, y1 = box
    out = Image.new("RGBA", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), (0, 0, 0, 0))
    for y in range(y0 - pad, y1 + pad):
        for x in range(x0 - pad, x1 + pad):
            p = im.getpixel((x, y))
            best: tuple[float, float, tuple[int, int, int]] | None = None
            for fg in fgs:
                den = sum((fg[i] - bg[i]) ** 2 for i in range(3))
                a = max(0.0, min(1.0, sum((p[i] - bg[i]) * (fg[i] - bg[i]) for i in range(3)) / den))
                err = sum((bg[i] + a * (fg[i] - bg[i]) - p[i]) ** 2 for i in range(3))
                if best is None or err < best[0]:
                    best = (err, a, fg)
            assert best is not None
            _, a, fg = best
            if a > 0.02:
                out.putpixel((x - x0 + pad, y - y0 + pad), (*fg, round(a * 255)))
    return out


def wordmark_path(font_path: Path) -> tuple[str, float]:
    font = instantiateVariableFont(TTFont(font_path), {"wght": 700})
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    scale = CAP_PX / font["OS/2"].sCapHeight
    text = "CASVITTA"

    def layout(track: float) -> list[tuple[str, float]]:
        x, items = 0.0, []
        for i, ch in enumerate(text):
            name = cmap[ord(ch)]
            items.append((name, x))
            x += glyphs[name].width + (track * upm if i < len(text) - 1 else 0)
        return items

    def ink(track: float) -> tuple[float, float]:
        xs: list[float] = []
        for name, x in layout(track):
            bp = BoundsPen(glyphs)
            glyphs[name].draw(bp)
            if bp.bounds:
                xs += [x + bp.bounds[0], x + bp.bounds[2]]
        return (max(xs) - min(xs)) * scale, min(xs)

    # Solve letter spacing so the outlined wordmark matches the approved board width.
    lo, hi = -0.05, 0.1
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if ink(mid)[0] < WORDMARK_W else (lo, mid)
    width, min_x = ink(lo)

    parts = []
    for name, x in layout(lo):
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, (x - min_x) * scale, 0)))
        parts.append(pen.getCommands())
    return " ".join(parts), width


def lockup_svg(d: str, width: float, ink: str) -> str:
    w = TEXT_X + width
    mx, my = -13 * MARK_SCALE, -12 * MARK_SCALE  # mark ink starts at viewBox (13, 12)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {MARK_EXTENT}" role="img" aria-label="Casvitta">
  <title>Casvitta</title>
  <g transform="translate({mx:.2f} {my:.2f}) scale({MARK_SCALE})">
    <path d="{MARK_PATH}" fill="none" stroke="{ink}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="66" cy="62" r="9" fill="#F2B23A"/>
  </g>
  <path transform="translate({TEXT_X} {BASELINE_Y})" fill="{ink}" d="{d}"/>
</svg>
"""


def app_icon_svg() -> str:
    # White mark on an ink-900 rounded square, radius 22% of the side.
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Casvitta">
  <rect width="100" height="100" rx="22" fill="#0F1E3D"/>
  <g transform="translate(50 50) scale(0.72) translate(-50 -50.5)">
    <path d="{MARK_PATH}" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="66" cy="62" r="9.5" fill="#F2B23A"/>
  </g>
</svg>
"""


def render_png(svg: str, size: int, dest: Path) -> None:
    data = resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size)
    raw = base64.b64decode(data) if isinstance(data, str) else bytes(data)
    Image.open(io.BytesIO(raw)).save(dest, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    board = Image.open(BOARD).convert("RGB")
    unmix(board, BOARD_LIGHT_BOX, WHITE, [INK, YELLOW], 8).save(OUT / "logo-lockup.png", optimize=True)
    unmix(board, BOARD_DARK_BOX, INK, [WHITE, YELLOW], 5).save(OUT / "logo-lockup-white.png", optimize=True)

    with tempfile.TemporaryDirectory() as tmp:
        font_path = Path(tmp) / "FamiljenGrotesk.ttf"
        urllib.request.urlretrieve(FONT_URL, font_path)
        d, width = wordmark_path(font_path)
    (OUT / "logo-lockup.svg").write_text(lockup_svg(d, width, "#0F1E3D"))
    (OUT / "logo-lockup-white.svg").write_text(lockup_svg(d, width, "#FFFFFF"))
    (OUT / "logo-mark.svg").write_text((ROOT / "design/logo-mark.svg").read_text())

    icon = app_icon_svg()
    (OUT / "app-icon.svg").write_text(icon)
    for size in (16, 32, 180, 512):
        render_png(icon, size, OUT / f"favicon-{size}.png")
    print(f"Wrote assets to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
