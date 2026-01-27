#!/usr/bin/env python3
"""Recompute rarity tiers from card title color for wiki-only weapons."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/borderlands/weapons/json"
IMG_DIR = ROOT / "data/borderlands/weapons/img/card"

BASE_TIERS = ["Common", "Uncommon"]


def parse_rarity_text(text):
    tiers = list(BASE_TIERS)
    if not text:
        return tiers
    t = text.lower()
    if "rare" in t:
        tiers.append("Rare")
    if "epic" in t:
        tiers += ["Rare", "Epic"]
    if "legendary" in t:
        tiers += ["Rare", "Epic", "Legendary"]
    if "pearlescent" in t:
        tiers += ["Rare", "Epic", "Legendary", "Pearlescent"]
    # de-dupe
    seen = []
    for v in tiers:
        if v not in seen:
            seen.append(v)
    return seen


def dominant_color(path):
    # kmeans over top bar, pick the most saturated cluster
    cmd = [
        "magick",
        str(path),
        "-crop",
        "100%x18%+0+0",
        "+repage",
        "-resize",
        "200x40",
        "-kmeans",
        "5",
        "-format",
        "%c",
        "histogram:info:-",
    ]
    out = subprocess.check_output(cmd, text=True)
    colors = []
    for line in out.splitlines():
        m = re.search(r"\(([^)]+)\)", line)
        if not m:
            continue
        parts = m.group(1).split(",")
        if len(parts) < 3:
            continue
        r = float(parts[0])
        g = float(parts[1])
        b = float(parts[2])
        colors.append((r, g, b))
    if not colors:
        return None

    def sat(c):
        r, g, b = [x / 255.0 for x in c]
        mx = max(r, g, b)
        mn = min(r, g, b)
        if mx == 0:
            return 0.0
        return (mx - mn) / mx

    colors.sort(key=sat, reverse=True)
    return colors[0]


def rarity_from_color(rgb):
    tiers = list(BASE_TIERS)
    if not rgb:
        return tiers
    r, g, b = rgb
    r /= 255.0
    g /= 255.0
    b /= 255.0
    mx = max(r, g, b)
    mn = min(r, g, b)
    delta = mx - mn
    if mx == 0 or delta < 0.08:
        return tiers
    if mx == r:
        hue = (60 * ((g - b) / delta) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / delta) + 120
    else:
        hue = 60 * ((r - g) / delta) + 240

    # hue-based rarity bands
    # orange -> Legendary, purple -> Epic, blue -> Rare, cyan -> Pearlescent
    if 20 <= hue < 55:
        tiers += ["Rare", "Epic", "Legendary"]
    elif 90 <= hue < 160:
        # green stays uncommon
        tiers += []
    elif 170 <= hue < 190:
        tiers += ["Rare", "Epic", "Legendary", "Pearlescent"]
    elif 190 <= hue < 250:
        tiers += ["Rare"]
    elif 250 <= hue < 320:
        tiers += ["Rare", "Epic"]

    # de-dupe
    seen = []
    for v in tiers:
        if v not in seen:
            seen.append(v)
    return seen


def main():
    for path in DATA_DIR.glob("*.json"):
        data = json.loads(path.read_text())
        res = data.get("resources", {})
        if "wiki" not in res or "lootlemon" in res:
            continue
        images = data.get("images", {})
        card = images.get("card") if isinstance(images, dict) else None
        if not card:
            continue
        img_path = (DATA_DIR / card).resolve() if card.startswith("..") else IMG_DIR / Path(card).name
        if not img_path.exists():
            continue
        rgb = dominant_color(img_path)
        rarity_text = None
        if "rarity" in data and data["rarity"]:
            rarity_text = data["rarity"][-1]
        tiers = parse_rarity_text(rarity_text)
        tiers = rarity_from_color(rgb)
        data["rarity"] = tiers
        path.write_text(json.dumps(data, indent=2) + "\n")

    print("updated")


if __name__ == "__main__":
    main()
