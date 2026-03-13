from __future__ import annotations

import json
import math
import sys
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/keogh/Sites/thekeogh/borderlens")
JSON_DIR = ROOT / "data/games/borderlands2/weapons"
LOCAL_DIR = ROOT / "public/img/games/borderlands2/weapons"
TMP_DIR = ROOT / ".agent/temp/weapon_compare"
WIKI_IMG_DIR = TMP_DIR / "wiki"
SHEET_DIR = TMP_DIR / "sheets"

BG = (247, 244, 238)
FG = (20, 20, 20)
ACCENT = (210, 205, 196)
CELL_W = 900
CELL_H = 220
COLS = 2


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


def wiki_img_url(page_url: str) -> str:
    parsed = urlparse(page_url)
    title = unquote(parsed.path.rsplit("/", 1)[-1])
    api_url = f"{parsed.scheme}://{parsed.netloc}/api.php"
    response = requests.get(
        api_url,
        params={
            "action": "parse",
            "page": title,
            "prop": "text",
            "formatversion": 2,
            "format": "json",
        },
        timeout=30,
        headers={"user-agent": "Mozilla/5.0 Codex weapon compare"},
    )
    response.raise_for_status()
    html = response.json()["parse"]["text"]
    soup = BeautifulSoup(html, "html.parser")
    figure = soup.select_one('figure[data-source="image"]')
    if figure is None:
        raise RuntimeError(f"no image figure found for {page_url}")

    anchor = figure.select_one("a")
    img = figure.select_one("img")
    for node, attr in (
        (img, "data-src"),
        (img, "src"),
        (anchor, "href"),
    ):
        if node is not None and node.get(attr):
            return urljoin(page_url, node[attr])
    raise RuntimeError(f"no image url found for {page_url}")


def download_image(url: str) -> bytes:
    response = requests.get(
        url,
        timeout=30,
        headers={"user-agent": "Mozilla/5.0 Codex weapon compare"},
    )
    response.raise_for_status()
    return response.content


def label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font: ImageFont.ImageFont) -> None:
    draw.text((x, y), text, fill=FG, font=font)


def place_image(canvas: Image.Image, image_path: Path, box: tuple[int, int, int, int]) -> None:
    with Image.open(image_path) as im:
        im = im.convert("RGBA")
        max_w = box[2] - box[0] - 20
        max_h = box[3] - box[1] - 20
        im.thumbnail((max_w, max_h), Image.LANCZOS)
        px = box[0] + (box[2] - box[0] - im.width) // 2
        py = box[1] + (box[3] - box[1] - im.height) // 2
        canvas.alpha_composite(im, (px, py))


def make_sheet(names: list[str], out_path: Path) -> None:
    rows = math.ceil(len(names) / COLS)
    title_h = 42
    pair_gap = 24
    canvas = Image.new("RGBA", (COLS * CELL_W, title_h + rows * CELL_H), BG + (255,))
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(22)
    label_font = load_font(16)
    draw.rectangle((0, 0, canvas.width, title_h), fill=(230, 225, 216))
    label(draw, 16, 10, "Generated image vs wiki original", title_font)

    for index, name in enumerate(names):
        col = index % COLS
        row = index // COLS
        x0 = col * CELL_W
        y0 = title_h + row * CELL_H
        draw.rectangle((x0, y0, x0 + CELL_W, y0 + CELL_H), outline=ACCENT, width=1)
        label(draw, x0 + 12, y0 + 10, name, label_font)
        label(draw, x0 + 12, y0 + 32, "generated", label_font)
        label(draw, x0 + CELL_W // 2 + 12, y0 + 32, "wiki", label_font)

        local_box = (x0 + 8, y0 + 56, x0 + CELL_W // 2 - pair_gap // 2, y0 + CELL_H - 8)
        wiki_box = (x0 + CELL_W // 2 + pair_gap // 2, y0 + 56, x0 + CELL_W - 8, y0 + CELL_H - 8)
        draw.rectangle(local_box, outline=ACCENT, width=1)
        draw.rectangle(wiki_box, outline=ACCENT, width=1)
        place_image(canvas, LOCAL_DIR / f"{name}.png", local_box)
        place_image(canvas, WIKI_IMG_DIR / f"{name}.png", wiki_box)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, quality=92)


def prepare_name(name: str) -> None:
    data = json.loads((JSON_DIR / f"{name}.json").read_text())
    page_url = data["resources"]["wiki"]
    img_url = wiki_img_url(page_url)
    content = download_image(img_url)
    WIKI_IMG_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(BytesIO(content)) as im:
        im.convert("RGBA").save(WIKI_IMG_DIR / f"{name}.png")


def main(args: list[str]) -> None:
    if not args:
        raise SystemExit("usage: compare_weapon_images.py weapon-slug [weapon-slug ...]")
    for name in args:
        prepare_name(name)
    for i in range(0, len(args), 8):
        make_sheet(args[i : i + 8], SHEET_DIR / f"compare_{i // 8 + 1:02d}.png")


if __name__ == "__main__":
    main(sys.argv[1:])
