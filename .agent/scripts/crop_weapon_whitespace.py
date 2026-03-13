from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image


ROOT = Path("/Users/keogh/Sites/thekeogh/borderlens")
WORK_DIR = ROOT / ".agent/worked"
BACKUP_DIR = ROOT / ".agent/temp/worked-pre-crop"

# Backgrounds in this set are near-white, but not perfectly uniform.
# Treat pixels as foreground once they are far enough from white.
WHITE_THRESHOLD = 244
MARGIN = 1


def is_foreground(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return False
    return min(r, g, b) < WHITE_THRESHOLD


def crop_box(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    width, height = im.size

    left = 0
    while left < width:
        if any(is_foreground(px[left, y]) for y in range(height)):
            break
        left += 1

    right = width - 1
    while right >= 0:
        if any(is_foreground(px[right, y]) for y in range(height)):
            break
        right -= 1

    top = 0
    while top < height:
        if any(is_foreground(px[x, top]) for x in range(width)):
            break
        top += 1

    bottom = height - 1
    while bottom >= 0:
        if any(is_foreground(px[x, bottom]) for x in range(width)):
            break
        bottom -= 1

    if left >= right or top >= bottom:
        raise RuntimeError("no foreground detected")

    return (
        max(0, left - MARGIN),
        max(0, top - MARGIN),
        min(width, right + MARGIN + 1),
        min(height, bottom + MARGIN + 1),
    )


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for path in sorted(WORK_DIR.glob("*.png")):
        backup_path = BACKUP_DIR / path.name
        if not backup_path.exists():
            shutil.copy2(path, backup_path)

        with Image.open(path) as im:
            rgba = im.convert("RGBA")
            box = crop_box(rgba)
            cropped = rgba.crop(box)
            cropped.save(path)
            print(f"{path.name}: {im.size} -> {cropped.size} box={box}")


if __name__ == "__main__":
    main()
