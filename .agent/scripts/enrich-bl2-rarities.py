#!/usr/bin/env python3
import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image
import colorsys

ROOT = Path.cwd()
WEAPONS_DIR = ROOT / "data/games/borderlands2/weapons"
REPORT_PATH = ROOT / ".agent/bl2/weapons/rarity-heuristic-report.json"

BASE_RARITIES = ["Common", "Uncommon", "Rare", "Epic"]
BASE_TIER = {name: index + 1 for index, name in enumerate(BASE_RARITIES)}
LEGENDARY_PLUS = {"Legendary", "Seraph", "Pearlescent", "Effervescent"}


@dataclass
class Change:
    slug: str
    name: str
    old: List[str]
    new: List[str]
    wiki_rarity: str
    image_color: Optional[str]
    image_confidence: float


def fetch_wiki_infobox_rarity_color(wiki_url: str, cache: Dict[str, Tuple[str, str]]) -> Tuple[str, str]:
    if wiki_url in cache:
        return cache[wiki_url]

    title = urllib.parse.unquote(wiki_url.split("/wiki/")[-1]).replace("_", " ")
    params = urllib.parse.urlencode({
        "action": "parse",
        "format": "json",
        "formatversion": "2",
        "page": title,
        "prop": "text",
        "redirects": "1",
    })
    request = urllib.request.Request(
        f"https://borderlands.fandom.com/api.php?{params}",
        headers={"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"},
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))

    html = payload.get("parse", {}).get("text", "")
    rarity_match = re.search(
        r'data-source="rarity"[\s\S]*?<div class="pi-data-value[^>]*">([\s\S]*?)</div>',
        html,
        re.IGNORECASE,
    )
    color_match = re.search(
        r'data-source="color"[\s\S]*?<div class="pi-data-value[^>]*">([\s\S]*?)</div>',
        html,
        re.IGNORECASE,
    )

    rarity = ""
    if rarity_match:
        rarity = re.sub(r"<[^>]*>", " ", rarity_match.group(1))
        rarity = re.sub(r"\s+", " ", rarity).strip()

    color = ""
    if color_match:
        color = re.sub(r"<[^>]*>", " ", color_match.group(1))
        color = re.sub(r"\s+", " ", color).strip()

    cache[wiki_url] = (rarity, color)
    return rarity, color


def rarity_from_wiki_color(color_label: str) -> Optional[str]:
    text = color_label.lower().strip()
    if not text:
        return None
    if "white" in text or "common" in text:
        return "Common"
    if "green" in text or "uncommon" in text:
        return "Uncommon"
    if "blue" in text or "rare" in text:
        return "Rare"
    if any(token in text for token in ["purple", "violet", "epic", "very rare"]):
        return "Epic"
    if "cursed" in text:
        return "Cursed"
    if "gem" in text:
        return "Gemstone"
    if any(token in text for token in ["e-tech", "cyan", "teal"]):
        return "E-tech"
    if any(token in text for token in ["legendary", "orange", "gold"]):
        return "Legendary"
    if any(token in text for token in ["effervescent", "rainbow"]):
        return "Effervescent"
    if any(token in text for token in ["seraph", "pink", "magenta"]):
        return "Seraph"
    if "pearl" in text:
        return "Pearlescent"
    return None


def rarity_tier_from_wiki_label(label: str) -> Optional[int]:
    text = label.lower().strip()
    if not text:
        return None
    if "unique" in text:
        return None
    if any(token in text for token in ["legendary", "seraph", "pearlescent", "effervescent", "cursed", "gemstone", "e-tech"]):
        return None
    if "very rare" in text or "epic" in text:
        return 4
    if re.search(r"\brare\b", text):
        return 3
    if "uncommon" in text:
        return 2
    if "common" in text:
        return 1
    return None


def classify_name_color(image_path: Path) -> Tuple[Optional[str], float]:
    if not image_path.exists():
        return None, 0.0

    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    # Name text area on BL-style item cards.
    x0, y0 = int(width * 0.056), int(height * 0.073)
    x1, y1 = int(width * 0.317), int(height * 0.132)

    roi = image.crop((x0, y0, x1, y1))
    scored: List[Tuple[float, float]] = []

    for red, green, blue in roi.getdata():
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if saturation > 0.18 and value > 0.25:
            scored.append((saturation * value, hue))

    if len(scored) < 40:
        return None, 0.0

    scored.sort(key=lambda entry: entry[0], reverse=True)
    top = scored[:120]

    buckets = {
        "purple": 0,
        "blue": 0,
        "green": 0,
        "orange": 0,
    }

    for _, hue in top:
        if 0.72 <= hue <= 0.92:
            buckets["purple"] += 1
        elif 0.52 <= hue < 0.72:
            buckets["blue"] += 1
        elif 0.23 <= hue < 0.52:
            buckets["green"] += 1
        elif hue < 0.17 or hue > 0.95:
            buckets["orange"] += 1

    dominant = max(buckets, key=buckets.get)
    confidence = buckets[dominant] / len(top)

    if confidence < 0.70:
        return None, confidence

    return dominant, confidence


def tier_from_color_bucket(bucket: Optional[str]) -> Optional[int]:
    if bucket == "green":
        return 2
    if bucket == "blue":
        return 3
    if bucket == "purple":
        return 4
    return None


def cumulative_rarities(max_tier: int) -> List[str]:
    return BASE_RARITIES[:max_tier]


def main() -> None:
    files = sorted(path for path in WEAPONS_DIR.glob("*.json"))
    cache: Dict[str, Tuple[str, str]] = {}
    changes: List[Change] = []

    scanned = 0
    skipped_no_wiki = 0
    skipped_legendary_plus = 0
    skipped_unique = 0
    skipped_non_base = 0
    skipped_no_wiki_tier = 0

    for file_path in files:
        item = json.loads(file_path.read_text("utf-8"))
        scanned += 1

        wiki_url = item.get("resources", {}).get("wiki")
        if not wiki_url:
            skipped_no_wiki += 1
            continue

        current_rarities: List[str] = item.get("rarities", [])

        if any(rarity in LEGENDARY_PLUS for rarity in current_rarities):
            skipped_legendary_plus += 1
            continue

        if any(rarity not in BASE_TIER for rarity in current_rarities):
            skipped_non_base += 1
            continue

        wiki_rarity, wiki_color = fetch_wiki_infobox_rarity_color(wiki_url, cache)
        if "unique" in wiki_rarity.lower():
            mapped = rarity_from_wiki_color(wiki_color)
            if mapped is None:
                skipped_unique += 1
                continue

            new_rarities = [mapped]
            if new_rarities == current_rarities:
                continue

            changes.append(Change(
                slug=item["slug"],
                name=item["name"],
                old=current_rarities,
                new=new_rarities,
                wiki_rarity=wiki_rarity,
                image_color=wiki_color or None,
                image_confidence=1.0,
            ))

            item["rarities"] = new_rarities
            file_path.write_text(f"{json.dumps(item, indent=2)}\n", "utf-8")
            continue

        wiki_tier = rarity_tier_from_wiki_label(wiki_rarity)
        if wiki_tier is None:
            skipped_no_wiki_tier += 1
            continue

        image_path = WEAPONS_DIR / "img" / f"{item['slug']}.png"
        color_bucket, confidence = classify_name_color(image_path)
        image_tier = tier_from_color_bucket(color_bucket)

        current_max = max((BASE_TIER[rarity] for rarity in current_rarities), default=1)
        target = max(current_max, wiki_tier)
        if image_tier is not None:
            target = max(target, image_tier)

        new_rarities = cumulative_rarities(target)
        if new_rarities == current_rarities:
            continue

        changes.append(Change(
            slug=item["slug"],
            name=item["name"],
            old=current_rarities,
            new=new_rarities,
            wiki_rarity=wiki_rarity,
            image_color=color_bucket,
            image_confidence=round(confidence, 3),
        ))

        item["rarities"] = new_rarities
        file_path.write_text(f"{json.dumps(item, indent=2)}\n", "utf-8")

    report = {
        "completedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "scanned": scanned,
        "changed": len(changes),
        "skippedNoWiki": skipped_no_wiki,
        "skippedLegendaryPlus": skipped_legendary_plus,
        "skippedUnique": skipped_unique,
        "skippedNonBaseRaritySet": skipped_non_base,
        "skippedNoWikiTier": skipped_no_wiki_tier,
        "changes": [change.__dict__ for change in changes],
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", "utf-8")

    print("\n".join([
        f"Scanned: {report['scanned']}",
        f"Changed: {report['changed']}",
        f"Skipped (no wiki): {report['skippedNoWiki']}",
        f"Skipped (legendary+): {report['skippedLegendaryPlus']}",
        f"Skipped (unique): {report['skippedUnique']}",
        f"Skipped (non-base rarity set): {report['skippedNonBaseRaritySet']}",
        f"Skipped (no wiki tier): {report['skippedNoWikiTier']}",
        f"Report: {REPORT_PATH}",
    ]))


if __name__ == "__main__":
    main()
