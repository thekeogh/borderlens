#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

USER_AGENT = {"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"}

LOOTLEMON_LIST_URL = "https://www.lootlemon.com/db/borderlands-2/grenade-mods"
WIKI_API_URL = "https://borderlands.fandom.com/api.php"
WIKI_CATEGORY_TITLE = "Category:Weapons_in_Borderlands_2"

OUTPUT_DIR = Path("data/games/borderlands2/grenade-mods")
REPORT_DIR = Path(".agent/bl2/grenade-mods")
REPORT_PATH = REPORT_DIR / "bootstrap-report.json"

CONTENT_MAP: Dict[str, str] = {
    "base-game-bl2": "Base Game",
    "pirates-booty-dlc": "Captain Scarlett and Her Pirate's Booty",
    "campaign-of-carnage-dlc": "Mr. Torgue's Campaign of Carnage",
    "big-game-hunt-dlc": "Sir Hammerlock's Big Game Hunt",
    "dragon-keep-dlc": "Tiny Tina's Assault on Dragon Keep",
    "fight-for-sanctuary-dlc": "Commander Lilith & the Fight for Sanctuary",
    "collectors-edition-cosmetic-pack": "Collector's Edition Pack",
}

RARITY_MAP: Dict[str, str] = {
    "a-common": "Common",
    "b-uncommon": "Uncommon",
    "c-rare": "Rare",
    "d-epic": "Epic",
    "e-tech": "E-tech",
    "f-legendary": "Legendary",
    "g-seraph": "Seraph",
    "h-pearlescent": "Pearlescent",
    "i-effervescent": "Effervescent",
}

COLOR_TO_RARITY: Dict[str, str] = {
    "white": "Common",
    "green": "Uncommon",
    "blue": "Rare",
    "purple": "Epic",
    "magenta": "E-tech",
    "orange": "Legendary",
    "pink": "Seraph",
    "pearl": "Pearlescent",
    "cyan": "Effervescent",
}

MANUFACTURER_MAP: Dict[str, str] = {
    "anshin": "Anshin",
    "bandit": "Bandit",
    "dahl": "Dahl",
    "hyperion": "Hyperion",
    "jakobs": "Jakobs",
    "maliwan": "Maliwan",
    "pangolin": "Pangolin",
    "tediore": "Tediore",
    "torgue": "Torgue",
    "vladof": "Vladof",
}

ELEMENT_MAP: Dict[str, str] = {
    "fire": "Incendiary",
    "incendiary": "Incendiary",
    "shock": "Shock",
    "corrosive": "Corrosive",
    "explosive": "Explosive",
    "slag": "Slag",
}

WIKI_TITLE_OVERRIDES: Dict[str, str] = {
    "Quasar": "Quasar (Borderlands 2)",
    "Rolling Thunder": "Rolling Thunder (grenade mod)",
    "Midnight Star": "Captain Blade's Midnight Star",
}


@dataclass
class LootlemonItem:
    content_slug: str
    detail_url: str
    manufacturer_slug: str
    name: str
    rarity_slug: str
    grenade_type: str
    slug: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Number of alphabetically sorted items to emit")
    return parser.parse_args()


def fetch_json(url: str, params: Dict[str, str]) -> dict:
    response = requests.get(url, params=params, headers=USER_AGENT, timeout=30)
    response.raise_for_status()
    return response.json()


def fetch_text(url: str) -> str:
    response = requests.get(url, headers=USER_AGENT, timeout=30)
    response.raise_for_status()
    return response.text


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def clean_multiline(value: str) -> str:
    lines = [clean_text(line) for line in value.splitlines()]
    lines = [line for line in lines if line]
    return "\n\n".join(lines).strip()


def normalize_key(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\s*\(borderlands 2\)\s*", "", value)
    value = re.sub(r"\s*\(grenade mod\)\s*", "", value)
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "", value)
    return value


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value


def strip_wiki_markup(value: str) -> str:
    text = value
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = text.replace("{{dash}}", "-")
    text = re.sub(r"'''+", "", text)
    text = re.sub(r"''", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return clean_text(text)


def extract_section_text(soup: BeautifulSoup, headings: List[str]) -> str:
    wanted = {heading.lower() for heading in headings}

    for h2 in soup.select("h2"):
        headline = h2.select_one(".mw-headline")
        heading_text = clean_text(headline.get_text(" ", strip=True) if headline else h2.get_text(" ", strip=True))
        if heading_text.lower() not in wanted:
            continue

        chunks: List[str] = []
        current = h2.find_next_sibling()
        while current and getattr(current, "name", None) != "h2":
            name = getattr(current, "name", "")
            if name == "p":
                text = clean_text(current.get_text(" ", strip=True))
                if text:
                    chunks.append(text)
            elif name in ("ul", "ol"):
                for li in current.select("li"):
                    text = clean_text(li.get_text(" ", strip=True))
                    if text:
                        chunks.append(text)
            current = current.find_next_sibling()

        if chunks:
            return clean_multiline("\n".join(chunks))

    return ""


def parse_wikitext_fields(wikitext: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for raw_line in wikitext.splitlines():
        line = raw_line.strip()
        if not line.startswith("|") or "=" not in line:
            continue
        key, value = line[1:].split("=", 1)
        key = clean_text(key).lower().replace(" ", "_")
        value = strip_wiki_markup(value)
        if key and value and key not in fields:
            fields[key] = value
    return fields


def get_wiki_category_titles() -> List[str]:
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmlimit": "max",
        "cmtitle": WIKI_CATEGORY_TITLE,
        "format": "json",
    }
    titles: List[str] = []
    while True:
        payload = fetch_json(WIKI_API_URL, params)
        titles.extend(item["title"] for item in payload.get("query", {}).get("categorymembers", []))
        if "continue" not in payload:
            break
        params.update(payload["continue"])
    return titles


def parse_lootlemon_list() -> List[LootlemonItem]:
    html = fetch_text(LOOTLEMON_LIST_URL)
    soup = BeautifulSoup(html, "html.parser")
    items: List[LootlemonItem] = []

    for node in soup.select("div.db_item.w-dyn-item"):
        name = clean_text(node.get("data-name", ""))
        content_slug = clean_text(node.get("data-content", ""))
        rarity_slug = clean_text(node.get("data-rarity", ""))
        manufacturer_slug = clean_text(node.get("data-manufacturer", ""))
        grenade_type = clean_text(node.get("data-type", ""))

        overlay = node.select_one("a.link-overlay")
        if not overlay:
            continue

        href = clean_text(overlay.get("href", ""))
        if not href.startswith("/grenade-mod/"):
            continue

        detail_url = f"https://www.lootlemon.com{href}"
        slug = href.replace("/grenade-mod/", "").replace("-bl2", "").strip("/")
        items.append(
            LootlemonItem(
                content_slug=content_slug,
                detail_url=detail_url,
                manufacturer_slug=manufacturer_slug,
                name=name,
                rarity_slug=rarity_slug,
                grenade_type=grenade_type,
                slug=slug,
            )
        )

    items.sort(key=lambda item: (item.name.lower(), item.slug))
    return items


def find_wiki_title(name: str, wiki_titles: List[str]) -> Optional[str]:
    if name in WIKI_TITLE_OVERRIDES:
        return WIKI_TITLE_OVERRIDES[name]
    if name in wiki_titles:
        return name

    wanted = normalize_key(name)
    for title in wiki_titles:
        if normalize_key(title) == wanted:
            return title
    return None


def wiki_grenade_titles(wiki_titles: List[str]) -> List[str]:
    out = []
    for title in wiki_titles:
        lower = title.lower()
        if "grenade" in lower and "grenadier" not in lower:
            out.append(title)
    return sorted(out)


def map_type(raw_type: str, title_hint: str = "") -> str:
    text = clean_text(raw_type or title_hint).lower()
    if "bouncing bet" in text:
        return "Bouncing Betty"
    if "mirv" in text:
        return "MIRV"
    if "transfusion" in text:
        return "Transfusion"
    if "singularity" in text:
        return "Singularity"
    if "area of effect" in text:
        return "Area of Effect"
    if "unique" in text:
        return "Unique"
    return "Standard"


def parse_wiki_manufacturers(raw: str) -> List[str]:
    if not raw:
        return []
    cleaned = clean_text(raw)
    pieces = re.split(r"[/,]| and ", cleaned, flags=re.IGNORECASE)
    values: List[str] = []
    for piece in pieces:
        key = clean_text(piece).lower()
        mapped = MANUFACTURER_MAP.get(key)
        if mapped and mapped not in values:
            values.append(mapped)
    return values


def parse_wiki_rarities(rarity_raw: str, color_raw: str) -> List[str]:
    rarity = clean_text(rarity_raw)
    color = clean_text(color_raw).lower()

    if rarity:
        normalized = rarity.lower()
        if normalized == "unique":
            mapped = COLOR_TO_RARITY.get(color)
            return [mapped] if mapped else []

        for enum_value in [
            "Common",
            "Uncommon",
            "Rare",
            "Epic",
            "E-tech",
            "Legendary",
            "Seraph",
            "Pearlescent",
            "Effervescent",
        ]:
            if enum_value.lower() == normalized:
                return [enum_value]

    mapped = COLOR_TO_RARITY.get(color)
    return [mapped] if mapped else []


def parse_wiki_elements(raw: str) -> List[str]:
    if not raw:
        return []
    cleaned = clean_text(raw).lower()
    values: List[str] = []
    for token, mapped in ELEMENT_MAP.items():
        if token in cleaned and mapped not in values:
            values.append(mapped)
    return values


def scrape_lootlemon_details(item: LootlemonItem) -> dict:
    loot_html = fetch_text(item.detail_url)
    loot_soup = BeautifulSoup(loot_html, "html.parser")

    def txt(selector: str) -> str:
        node = loot_soup.select_one(selector)
        if not node:
            return ""
        return clean_text(node.get_text(" ", strip=True))

    red_text = txt("#red-text")
    about_text = txt(".w-tab-pane[data-w-tab='Details'] .margin-left.w-embed p")
    unique_text = txt(".w-tab-pane[data-w-tab='Details'] .framed-txt .w-richtext")

    elements: List[str] = []
    for img in loot_soup.select("#item-elements img.icon-round"):
        classes = " ".join(img.get("class", []))
        if "w-condition-invisible" in classes:
            continue
        alt = clean_text(img.get("alt", ""))
        mapped = ELEMENT_MAP.get(alt.lower())
        if mapped and mapped not in elements:
            elements.append(mapped)

    sources: List[dict] = []
    for card in loot_soup.select("#item-source .card.w-dyn-item"):
        name_node = card.select_one(".card_details h3")
        if not name_node:
            continue
        source_name = clean_text(name_node.get_text(" ", strip=True))
        tags = [clean_text(tag.get_text(" ", strip=True)) for tag in card.select(".card_details .card_tag")]
        tags = [tag for tag in tags if tag]
        if source_name:
            sources.append({"name": source_name, "tags": tags})

    return {
        "about_text": about_text,
        "elements": elements,
        "red_text": red_text,
        "sources": sources,
        "special_text": unique_text,
    }


def scrape_wiki_details(wiki_title: str) -> dict:
    payload = fetch_json(
        WIKI_API_URL,
        {
            "action": "parse",
            "page": wiki_title,
            "prop": "text|wikitext",
            "format": "json",
            "formatversion": "2",
            "redirects": "1",
        },
    )
    parsed = payload.get("parse", {})
    resolved_title = parsed.get("title", wiki_title)
    wiki_url = f"https://borderlands.fandom.com/wiki/{resolved_title.replace(' ', '_')}"

    html = parsed.get("text", "")
    soup = BeautifulSoup(html, "html.parser")
    usage = extract_section_text(soup, ["Usage & Description", "Usage and Description"])
    notes = extract_section_text(soup, ["Notes"])
    trivia = extract_section_text(soup, ["Trivia"])
    special = extract_section_text(
        soup,
        [
            "Special Effect",
            "Special Grenade Effect",
            "Special Grenade Effects",
            "Special Weapon Effects",
        ],
    )

    wikitext = parsed.get("wikitext", "")
    fields = parse_wikitext_fields(wikitext)

    if not special:
        for heading in (
            "Special Grenade Effect",
            "Special Grenade Effects",
            "Special Effect",
            "Special Weapon Effects",
        ):
            match = re.search(
                rf"==\s*{re.escape(heading)}\s*==\n([\s\S]*?)(?=\n==|$)",
                wikitext,
            )
            if match:
                special = clean_text(strip_wiki_markup(match.group(1)))
                if special:
                    break

    return {
        "fields": fields,
        "notes": clean_multiline("\n".join([part for part in [notes, trivia] if part])),
        "special": special,
        "usage": usage,
        "wiki_url": wiki_url,
    }


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "img").mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def canonical_name_from_title(title: str) -> str:
    name = re.sub(r"\s*\(Borderlands 2\)\s*", "", title, flags=re.IGNORECASE)
    name = re.sub(r"\s*\(grenade mod\)\s*", "", name, flags=re.IGNORECASE)
    return clean_text(name)


def build_doc(
    name: str,
    slug: str,
    loot_item: Optional[LootlemonItem],
    wiki_title: Optional[str],
) -> dict:
    loot = scrape_lootlemon_details(loot_item) if loot_item else {
        "about_text": "",
        "elements": [],
        "red_text": "",
        "sources": [],
        "special_text": "",
    }
    wiki = scrape_wiki_details(wiki_title) if wiki_title else {
        "fields": {},
        "notes": "",
        "special": "",
        "usage": "",
        "wiki_url": None,
    }

    fields = wiki["fields"]

    type_value = map_type(
        loot_item.grenade_type if loot_item else fields.get("model", fields.get("type", "")),
        title_hint=name,
    )

    content = "Base Game"
    if loot_item:
        content = CONTENT_MAP.get(loot_item.content_slug, "Base Game")
    elif fields.get("game1", "").lower() not in ("", "borderlands 2"):
        content = "Base Game"

    rarity_values: List[str] = []
    if loot_item:
        rarity_values = [RARITY_MAP.get(loot_item.rarity_slug, "Rare")]
    else:
        rarity_values = parse_wiki_rarities(fields.get("rarity", ""), fields.get("color", ""))
        if not rarity_values:
            rarity_values = ["Common"]

    manufacturers: List[str] = []
    if loot_item:
        mapped = MANUFACTURER_MAP.get(loot_item.manufacturer_slug.lower())
        if mapped:
            manufacturers.append(mapped)
    if not manufacturers:
        manufacturers = parse_wiki_manufacturers(fields.get("manufacturer", ""))
    if not manufacturers:
        name_hint = name.lower()
        if "tediore" in name_hint:
            manufacturers = ["Tediore"]
        elif "bouncing betty" in name_hint:
            manufacturers = ["Dahl"]

    elements = loot["elements"] or parse_wiki_elements(fields.get("element", ""))

    description = clean_multiline(
        "\n".join(part for part in [loot["about_text"], wiki["usage"]] if part)
    )
    if not description:
        description = clean_text(f"{name} is a Borderlands 2 grenade mod.")

    notes = wiki["notes"]
    special_description = clean_multiline(
        "\n".join(part for part in [loot["special_text"], wiki["special"]] if part)
    )
    red_text = loot["red_text"]

    resources: Dict[str, str] = {}
    if loot_item:
        resources["lootlemon"] = loot_item.detail_url
    if wiki.get("wiki_url"):
        resources["wiki"] = wiki["wiki_url"]

    doc: Dict[str, object] = {
        "category": "grenade-mods",
        "content": content,
        "dlc": content != "Base Game",
        "image": f"/img/games/borderlands2/grenade-mods/{slug}.png",
        "resources": resources,
        "name": name,
        "slug": slug,
        "type": type_value,
        "description": description,
        "manufacturers": manufacturers,
        "rarities": rarity_values,
    }

    if elements:
        doc["elements"] = elements

    if loot["sources"]:
        doc["sources"] = loot["sources"]

    if notes:
        doc["notes"] = notes

    if red_text or special_description:
        special: Dict[str, str] = {"description": special_description or ""}
        if red_text:
            special["title"] = red_text
        doc["special"] = special

    return doc


def main() -> None:
    args = parse_args()
    ensure_dirs()

    loot_items = parse_lootlemon_list()
    wiki_titles = get_wiki_category_titles()

    loot_by_name = {normalize_key(item.name): item for item in loot_items}
    wiki_title_lookup = {normalize_key(title): title for title in wiki_titles}

    candidates: List[dict] = []

    for item in loot_items:
        wiki_title = find_wiki_title(item.name, wiki_titles)
        candidates.append(
            {
                "name": item.name,
                "slug": item.slug,
                "loot": item,
                "wiki_title": wiki_title,
            }
        )

    for title in wiki_grenade_titles(wiki_titles):
        key = normalize_key(title)
        if key in loot_by_name:
            continue

        canonical_name = canonical_name_from_title(title)
        if normalize_key(canonical_name) in loot_by_name:
            continue

        if key in wiki_title_lookup:
            candidates.append(
                {
                    "name": canonical_name,
                    "slug": slugify(canonical_name),
                    "loot": None,
                    "wiki_title": title,
                }
            )

    candidates.sort(key=lambda candidate: (candidate["name"].lower(), candidate["slug"]))
    if args.limit and args.limit > 0:
        candidates = candidates[: args.limit]

    written = 0
    wiki_only = 0
    with_wiki = 0
    created: List[str] = []

    for candidate in candidates:
        doc = build_doc(
            name=candidate["name"],
            slug=candidate["slug"],
            loot_item=candidate["loot"],
            wiki_title=candidate["wiki_title"],
        )
        if candidate["loot"] is None:
            wiki_only += 1
        if doc["resources"].get("wiki"):
            with_wiki += 1

        output_path = OUTPUT_DIR / f"{candidate['slug']}.json"
        output_path.write_text(f"{json.dumps(doc, indent=2, ensure_ascii=True)}\n", encoding="utf-8")
        created.append(output_path.name)
        written += 1

    report = {
        "lootlemon_items": len(loot_items),
        "wiki_category_members": len(wiki_titles),
        "written": written,
        "wiki_only_written": wiki_only,
        "with_wiki_url": with_wiki,
        "created_files": created,
    }
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
