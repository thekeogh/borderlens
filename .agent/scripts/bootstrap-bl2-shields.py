#!/usr/bin/env python3
import json
import re
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

USER_AGENT = {"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"}

LOOTLEMON_LIST_URL = "https://www.lootlemon.com/db/borderlands-2/shields"
WIKI_API_URL = "https://borderlands.fandom.com/api.php"
WIKI_CATEGORY_TITLE = "Category:Shields_in_Borderlands_2"

OUTPUT_DIR = Path("data/games/borderlands2/shields")
REPORT_DIR = Path(".agent/bl2/shields")
REPORT_PATH = REPORT_DIR / "bootstrap-report.json"

CONTENT_MAP: Dict[str, str] = {
    "base-game-bl2": "Base Game",
    "pirates-booty-dlc": "Captain Scarlett and Her Pirate's Booty",
    "campaign-of-carnage-dlc": "Mr. Torgue's Campaign of Carnage",
    "big-game-hunt-dlc": "Sir Hammerlock's Big Game Hunt",
    "dragon-keep-dlc": "Tiny Tina's Assault on Dragon Keep",
    "fight-for-sanctuary-dlc": "Commander Lilith & the Fight for Sanctuary",
}

RARITY_MAP: Dict[str, str] = {
    "c-rare": "Rare",
    "d-epic": "Epic",
    "f-legendary": "Legendary",
    "g-seraph": "Seraph",
    "i-effervescent": "Effervescent",
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

# Known title mismatches between Lootlemon and wiki category.
WIKI_TITLE_OVERRIDES: Dict[str, str] = {
    "Big Boom Blaster": "Big Boom Blaster (Borderlands 2)",
    "Cracked Sash": "Cracked Sash (Borderlands 2)",
    "Hoplite": "Hoplite (shield)",
    "Manly Man Shield": "Captain Blade's Manly Man Shield",
    "Order": "Order (shield)",
    "The Transformer": "The Transformer (Borderlands 2)",
}


@dataclass
class LootlemonItem:
    content_slug: str
    detail_url: str
    manufacturer_slug: str
    name: str
    rarity_slug: str
    shield_type: str
    slug: str


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
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "", value)
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
        shield_type = clean_text(node.get("data-type", ""))

        overlay = node.select_one("a.link-overlay")
        if not overlay:
            continue

        href = clean_text(overlay.get("href", ""))
        if not href.startswith("/shield/"):
            continue

        detail_url = f"https://www.lootlemon.com{href}"
        slug = href.replace("/shield/", "").replace("-bl2", "").strip("/")
        items.append(
            LootlemonItem(
                content_slug=content_slug,
                detail_url=detail_url,
                manufacturer_slug=manufacturer_slug,
                name=name,
                rarity_slug=rarity_slug,
                shield_type=shield_type,
                slug=slug,
            )
        )

    items.sort(key=lambda item: item.name.lower())
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


def scrape_shield_details(item: LootlemonItem, wiki_title: Optional[str]) -> dict:
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

    wiki_usage = ""
    wiki_special = ""
    wiki_notes = ""
    wiki_trivia = ""
    wiki_url = None

    if wiki_title:
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
        wiki_special = extract_section_text(
            soup,
            ["Special Shield Effect", "Special Shield Effects", "Special Weapon Effects"],
        )
        wiki_usage = extract_section_text(soup, ["Usage & Description", "Usage and Description"])
        wiki_notes = extract_section_text(soup, ["Notes"])
        wiki_trivia = extract_section_text(soup, ["Trivia"])

        # Wikitext fallback for special sections if HTML extraction is empty.
        if not wiki_special:
            wikitext = parsed.get("wikitext", "")
            for heading in ("Special Shield Effects", "Special Shield Effect", "Special Weapon Effects"):
                match = re.search(
                    rf"==\s*{re.escape(heading)}\s*==\n([\s\S]*?)(?=\n==|$)",
                    wikitext,
                )
                if match:
                    wiki_special = strip_wiki_markup(match.group(1))
                    if wiki_special:
                        break

    description_parts = [part for part in [about_text, wiki_usage] if part]
    notes_parts = [part for part in [wiki_notes, wiki_trivia] if part]
    special_parts = [part for part in [unique_text, wiki_special] if part]

    return {
        "description_raw": clean_multiline("\n".join(description_parts)),
        "elements": elements,
        "notes_raw": clean_multiline("\n".join(notes_parts)),
        "red_text": red_text,
        "sources": sources,
        "special_raw": clean_multiline("\n".join(special_parts)),
        "wiki_url": wiki_url,
    }


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "img").mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    ensure_dirs()
    loot_items = parse_lootlemon_list()
    wiki_titles = get_wiki_category_titles()

    written = 0
    with_wiki = 0
    missing_wiki: List[str] = []

    for item in loot_items:
        wiki_title = find_wiki_title(item.name, wiki_titles)
        details = scrape_shield_details(item, wiki_title)
        wiki_url = details["wiki_url"]

        if wiki_url:
            with_wiki += 1
        else:
            missing_wiki.append(item.name)

        content = CONTENT_MAP.get(item.content_slug, "Base Game")
        rarity = RARITY_MAP.get(item.rarity_slug, "Rare")
        manufacturer = MANUFACTURER_MAP.get(item.manufacturer_slug.lower(), item.manufacturer_slug)

        doc: Dict[str, object] = {
            "category": "shields",
            "content": content,
            "dlc": content != "Base Game",
            "image": f"/img/games/borderlands2/shields/{item.slug}.png",
            "resources": {
                "lootlemon": item.detail_url,
            },
            "name": item.name,
            "slug": item.slug,
            "type": item.shield_type,
            "description": details["description_raw"] or clean_text(
                f"{item.name} is a {rarity.lower()} {item.shield_type.lower()} shield."
            ),
            "manufacturers": [manufacturer],
            "rarities": [rarity],
            "sources": details["sources"],
        }

        if wiki_url:
            doc["resources"]["wiki"] = wiki_url

        if details["elements"]:
            doc["elements"] = details["elements"]

        notes = details["notes_raw"]
        if notes:
            doc["notes"] = notes

        red_text = details["red_text"]
        special_raw = details["special_raw"]
        if red_text or special_raw:
            doc["special"] = {
                "description": special_raw or "",
            }
            if red_text:
                doc["special"]["title"] = red_text

        output_path = OUTPUT_DIR / f"{item.slug}.json"
        output_path.write_text(f"{json.dumps(doc, indent=2, ensure_ascii=True)}\n", encoding="utf-8")
        written += 1

    report = {
        "written": written,
        "lootlemon_items": len(loot_items),
        "wiki_category_members": len(wiki_titles),
        "with_wiki_url": with_wiki,
        "missing_wiki_url": len(missing_wiki),
        "missing_wiki_items": missing_wiki,
    }
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
