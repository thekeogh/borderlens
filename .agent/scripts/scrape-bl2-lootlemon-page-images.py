#!/usr/bin/env python3
import json
import mimetypes
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


USER_AGENT = {"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"}
ROOT = Path("data/games/borderlands2")
TEMP_ROOT = Path(".agent/temp/lootlemon-page-image")


def absolute_url(src: str) -> str:
    src = (src or "").strip()
    if src.startswith("//"):
        return f"https:{src}"
    if src.startswith("/"):
        return f"https://www.lootlemon.com{src}"
    return src


def guess_ext(image_url: str, content_type: str) -> str:
    parsed = urlparse(image_url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension((content_type or "").split(";")[0].strip())
    if guessed:
        return guessed
    return ".img"


def fetch_page_image_url(page_url: str) -> str:
    response = requests.get(page_url, headers=USER_AGENT, timeout=40)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    image = soup.select_one("img#page-image")
    if not image:
        return ""
    src = image.get("src") or image.get("data-src") or ""
    return absolute_url(src)


def download_to_temp(image_url: str, temp_path: Path) -> None:
    response = requests.get(image_url, headers=USER_AGENT, timeout=60)
    response.raise_for_status()
    temp_path.write_bytes(response.content)


def to_png(source: Path, destination: Path) -> None:
    subprocess.run(
        ["sips", "-s", "format", "png", str(source), "--out", str(destination)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)

    scanned = 0
    with_lootlemon = 0
    downloaded = 0
    missing_page_image = []
    failed = []

    for path in sorted(ROOT.glob("*/*.json")):
        scanned += 1
        item = json.loads(path.read_text(encoding="utf-8"))
        resources = item.get("resources") or {}
        lootlemon = (resources.get("lootlemon") or "").strip()
        if not lootlemon:
            continue

        with_lootlemon += 1
        category_dir = path.parent
        slug = (item.get("slug") or path.stem).strip() or path.stem
        out_dir = category_dir / "img" / "lootlemon"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_png = out_dir / f"{slug}.png"

        try:
            page_image = fetch_page_image_url(lootlemon)
            if not page_image:
                missing_page_image.append(str(path))
                continue

            head = requests.head(page_image, headers=USER_AGENT, timeout=30, allow_redirects=True)
            content_type = head.headers.get("content-type", "")
            ext = guess_ext(page_image, content_type)
            temp_file = TEMP_ROOT / f"{slug}{ext}"

            download_to_temp(page_image, temp_file)
            to_png(temp_file, out_png)
            temp_file.unlink(missing_ok=True)
            downloaded += 1
        except Exception as error:  # noqa: BLE001
            failed.append({"file": str(path), "error": str(error)})

    report = {
        "scanned": scanned,
        "with_lootlemon": with_lootlemon,
        "downloaded": downloaded,
        "missing_page_image": len(missing_page_image),
        "missing_page_image_items": missing_page_image[:100],
        "failed": len(failed),
        "failures": failed[:100],
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
