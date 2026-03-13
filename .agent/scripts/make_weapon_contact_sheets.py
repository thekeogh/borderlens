from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/keogh/Sites/thekeogh/borderlens")
IMAGE_DIR = ROOT / "public/img/games/borderlands2/weapons"
OUT_DIR = ROOT / ".agent/temp/weapon_contact_sheets"

CELL_W = 360
CELL_H = 140
LABEL_H = 28
COLS = 4
BG = (247, 244, 238)
FG = (20, 20, 20)
ACCENT = (210, 205, 196)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        "/System/Library/Fonts/Supplemental/Menlo.ttc",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_sheet(paths: list[Path], out_path: Path, title: str) -> None:
    rows = math.ceil(len(paths) / COLS)
    title_h = 42
    canvas = Image.new("RGBA", (COLS * CELL_W, title_h + rows * (CELL_H + LABEL_H)), BG + (255,))
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(22)
    label_font = load_font(16)
    draw.rectangle((0, 0, canvas.width, title_h), fill=(230, 225, 216))
    draw.text((16, 10), title, fill=FG, font=title_font)

    for index, path in enumerate(paths):
        col = index % COLS
        row = index // COLS
        x0 = col * CELL_W
        y0 = title_h + row * (CELL_H + LABEL_H)
        draw.rectangle((x0, y0, x0 + CELL_W, y0 + CELL_H + LABEL_H), outline=ACCENT, width=1)

        with Image.open(path) as im:
            im = im.convert("RGBA")
            im.thumbnail((CELL_W - 16, CELL_H - 16), Image.LANCZOS)
            px = x0 + (CELL_W - im.width) // 2
            py = y0 + (CELL_H - im.height) // 2
            canvas.alpha_composite(im, (px, py))

        label = path.stem
        bbox = draw.textbbox((0, 0), label, font=label_font)
        tx = x0 + max(8, (CELL_W - (bbox[2] - bbox[0])) // 2)
        ty = y0 + CELL_H + 5
        draw.text((tx, ty), label, fill=FG, font=label_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, quality=92)


def main() -> None:
    paths = sorted(IMAGE_DIR.glob("*.png"))
    chunk = 40
    for i in range(0, len(paths), chunk):
        batch = paths[i : i + chunk]
        title = f"Borderlands 2 weapons {i + 1}-{i + len(batch)} of {len(paths)}"
        make_sheet(batch, OUT_DIR / f"sheet_{i // chunk + 1:02d}.png", title)


if __name__ == "__main__":
    main()
