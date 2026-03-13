from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image


ROOT = Path("/Users/keogh/Sites/thekeogh/borderlens")
JSON_DIR = ROOT / "data/games/borderlands2/weapons"
OUT_DIR = ROOT / ".agent/wiki-originals/borderlands2-weapons"


def parse_largest_srcset(srcset: str) -> str:
    best_url = ""
    best_scale = -1.0
    for part in srcset.split(","):
        entry = part.strip()
        if not entry:
            continue
        pieces = entry.split()
        url = pieces[0]
        scale = 1.0
        if len(pieces) > 1 and pieces[1].endswith("x"):
            try:
                scale = float(pieces[1][:-1])
            except ValueError:
                scale = 1.0
        if scale > best_scale:
            best_scale = scale
            best_url = url
    if not best_url:
        raise RuntimeError("no srcset URL found")
    return best_url


def wiki_image_url(page_url: str) -> str:
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
        headers={"user-agent": "Mozilla/5.0 Codex wiki original downloader"},
    )
    response.raise_for_status()
    html = response.json()["parse"]["text"]
    soup = BeautifulSoup(html, "html.parser")
    image = soup.select_one('figure[data-source="image"] img')
    if image is None:
        raise RuntimeError(f"no image found for {page_url}")
    srcset = image.get("srcset")
    if srcset:
        return parse_largest_srcset(srcset)
    src = image.get("data-src") or image.get("src")
    if src:
        return src
    raise RuntimeError(f"no usable image URL for {page_url}")


def download_as_png(image_url: str, out_path: Path) -> None:
    response = requests.get(
        image_url,
        timeout=30,
        headers={"user-agent": "Mozilla/5.0 Codex wiki original downloader"},
    )
    response.raise_for_status()
    with Image.open(BytesIO(response.content)) as im:
        im.convert("RGBA").save(out_path)


def fetch_weapon(name: str) -> str:
    data = json.loads((JSON_DIR / f"{name}.json").read_text())
    page_url = data["resources"]["wiki"]
    image_url = wiki_image_url(page_url)
    out_path = OUT_DIR / f"{name}.png"
    download_as_png(image_url, out_path)
    return image_url


def main(names: list[str]) -> None:
    if not names:
        raise SystemExit("usage: download_wiki_weapon_originals.py weapon-slug [weapon-slug ...]")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in names:
        image_url = fetch_weapon(name)
        print(f"{name} {image_url}")


if __name__ == "__main__":
    main(sys.argv[1:])
