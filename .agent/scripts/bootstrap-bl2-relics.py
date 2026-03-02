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

LOOTLEMON_LIST_URL = "https://www.lootlemon.com/db/borderlands-2/relics"
WIKI_API_URL = "https://borderlands.fandom.com/api.php"
WIKI_CATEGORY_TITLE = "Category:Relics"

OUTPUT_DIR = Path("data/games/borderlands2/relics")
REPORT_DIR = Path(".agent/bl2/relics")
REPORT_PATH = REPORT_DIR / "bootstrap-report.json"

CONTENT_MAP: Dict[str, str] = {
    "base-game-bl2": "Base Game",
    "premiere-club-bl2": "Premiere Club",
    "pirates-booty-dlc": "Captain Scarlett and Her Pirate's Booty",
    "campaign-of-carnage-dlc": "Mr. Torgue's Campaign of Carnage",
    "big-game-hunt-dlc": "Sir Hammerlock's Big Game Hunt",
    "dragon-keep-dlc": "Tiny Tina's Assault on Dragon Keep",
    "ultimate-upgrade-feature-pack": "Ultimate Vault Hunter Upgrade Pack",
    "fight-for-sanctuary-dlc": "Commander Lilith & the Fight for Sanctuary",
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
    "eridian": "Eridian",
}

WIKI_TITLE_OVERRIDES: Dict[str, str] = {
    "Otto Idol": "Captain Blade's Otto Idol",
}

LOOT_NAME_OVERRIDES: Dict[str, str] = {
    "Otto Idol": "Captain Blade's Otto Idol",
}

NAME_ALIASES: Dict[str, List[str]] = {
    "Captain Blade's Otto Idol": ["Otto Idol"],
}


@dataclass
class LootlemonItem:
    content_slug: str
    detail_url: str
    name: str
    rarity_slug: str
    relic_type: str
    slug: str


@dataclass
class Candidate:
    loot_item: Optional[LootlemonItem]
    name: str
    wiki_title: Optional[str]


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


def sanitize_narrative(value: str) -> str:
    if not value:
        return ""
    text = clean_multiline(value)
    text = text.replace("This article is a stub . You can help Borderlands Wiki by expanding it .", "").strip()
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def normalize_key(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\s*\(borderlands 2\)\s*", "", value)
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


def extract_intro_text(soup: BeautifulSoup) -> str:
    for p in soup.select("p"):
        text = clean_text(p.get_text(" ", strip=True))
        if text:
            return text
    return ""


def canonical_name_from_title(title: str) -> str:
    name = re.sub(r"\s*\(borderlands 2\)\s*", "", title, flags=re.IGNORECASE)
    return clean_text(name)


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
        relic_type = clean_text(node.get("data-type", ""))

        overlay = node.select_one("a.link-overlay")
        if not overlay:
            continue

        href = clean_text(overlay.get("href", ""))
        if not href.startswith("/bonus-item/"):
            continue

        detail_url = f"https://www.lootlemon.com{href}"
        slug = href.replace("/bonus-item/", "").replace("-bl2", "").strip("/")

        name = LOOT_NAME_OVERRIDES.get(name, name)

        items.append(
            LootlemonItem(
                content_slug=content_slug,
                detail_url=detail_url,
                name=name,
                rarity_slug=rarity_slug,
                relic_type=relic_type,
                slug=slug,
            )
        )

    items.sort(key=lambda item: (item.name.lower(), item.slug))
    return items


def parse_wiki_manufacturers(raw: str) -> List[str]:
    if not raw:
        return []
    values: List[str] = []
    for piece in re.split(r"[/,]| and ", clean_text(raw), flags=re.IGNORECASE):
        key = clean_text(piece).lower()
        mapped = MANUFACTURER_MAP.get(key)
        if mapped and mapped not in values:
            values.append(mapped)
    return values


def parse_wiki_rarities(rarity_raw: str, color_raw: str) -> List[str]:
    rarity = clean_text(rarity_raw).lower()
    color = clean_text(color_raw).lower()

    if rarity == "common":
        return ["Common", "Uncommon", "Rare", "Epic"]

    if rarity == "unique":
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
        if enum_value.lower() == rarity:
            return [enum_value]

    mapped = COLOR_TO_RARITY.get(color)
    return [mapped] if mapped else []


def map_relic_type(raw_type: str, name_hint: str = "", model_hint: str = "") -> str:
    text = clean_text(raw_type or model_hint or name_hint).lower()
    text = text.replace("relic", "").strip()

    if "aggression" in text:
        return "Aggression"
    if "allegiance" in text:
        return "Allegiance"
    if "elemental" in text:
        return "Elemental"
    if "proficiency" in text:
        return "Proficiency"
    if "protection" in text:
        return "Protection"
    if "resistance" in text:
        return "Resistance"
    if "stockpile" in text:
        return "Stockpile"
    if "strength" in text:
        return "Strength"
    if "survivability" in text:
        return "Survivability"
    if "tenacity" in text:
        return "Tenacity"
    if "vitality" in text:
        return "Vitality"
    if "offense" in text:
        return "Offense"
    if "universal" in text:
        return "Universal"
    if "unique" in text:
        return "Unique"
    return "Universal"


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
            "Special Effects",
            "Special Relic Effect",
            "Special Relic Effects",
        ],
    )
    intro = extract_intro_text(soup)

    wikitext = parsed.get("wikitext", "")
    fields = parse_wikitext_fields(wikitext)

    if not special:
        for heading in (
            "Special Relic Effects",
            "Special Relic Effect",
            "Special Effects",
            "Special Effect",
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
        "intro": intro,
        "notes": clean_multiline("\n".join([part for part in [notes, trivia] if part])),
        "special": special,
        "usage": usage,
        "wiki_url": wiki_url,
    }


def build_doc(candidate: Candidate, slug: str) -> dict:
    loot = scrape_lootlemon_details(candidate.loot_item) if candidate.loot_item else {
        "about_text": "",
        "red_text": "",
        "sources": [],
        "special_text": "",
    }

    wiki = scrape_wiki_details(candidate.wiki_title) if candidate.wiki_title else {
        "fields": {},
        "intro": "",
        "notes": "",
        "special": "",
        "usage": "",
        "wiki_url": None,
    }

    fields = wiki["fields"]

    type_value = map_relic_type(
        candidate.loot_item.relic_type if candidate.loot_item else fields.get("model", fields.get("type", "")),
        name_hint=candidate.name,
        model_hint=fields.get("model", ""),
    )

    content = "Base Game"
    if candidate.loot_item:
        content = CONTENT_MAP.get(candidate.loot_item.content_slug, "Base Game")

    if candidate.loot_item:
        rarity_value = RARITY_MAP.get(candidate.loot_item.rarity_slug, "Rare")
        rarities = [rarity_value]
    else:
        rarities = parse_wiki_rarities(fields.get("rarity", ""), fields.get("color", ""))
        if not rarities:
            rarities = ["Common", "Uncommon", "Rare", "Epic"]

    manufacturers = parse_wiki_manufacturers(fields.get("manufacturer", ""))
    if not manufacturers:
        manufacturers = ["Eridian"] if candidate.name.lower() != "relic" else []

    description = sanitize_narrative(
        "\n".join(part for part in [loot["about_text"], wiki["usage"], wiki["intro"]] if part)
    )
    if not description:
        description = clean_text(f"{candidate.name} is a Borderlands 2 relic.")

    notes = sanitize_narrative(wiki["notes"])
    special_description = sanitize_narrative(
        "\n".join(part for part in [loot["special_text"], wiki["special"]] if part)
    )
    red_text = loot["red_text"]

    resources: Dict[str, str] = {}
    if candidate.loot_item:
        resources["lootlemon"] = candidate.loot_item.detail_url
    if wiki.get("wiki_url"):
        resources["wiki"] = wiki["wiki_url"]

    doc: Dict[str, object] = {
        "category": "relics",
        "content": content,
        "dlc": content != "Base Game",
        "image": f"/img/games/borderlands2/relics/{slug}.png",
        "resources": resources,
        "name": candidate.name,
        "slug": slug,
        "type": type_value,
        "description": description,
        "manufacturers": manufacturers,
        "rarities": rarities,
    }

    aliases = NAME_ALIASES.get(candidate.name, [])
    if aliases:
        doc["aliases"] = aliases

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


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "img").mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def is_wiki_relic_candidate(title: str) -> bool:
    if title.startswith("File:"):
        return False
    if title.lower().startswith("list of relics"):
        return False
    return True


def main() -> None:
    args = parse_args()
    ensure_dirs()

    loot_items = parse_lootlemon_list()
    wiki_titles_all = get_wiki_category_titles()
    wiki_titles = [title for title in wiki_titles_all if is_wiki_relic_candidate(title)]

    candidates: List[Candidate] = []
    seen: set[str] = set()

    for item in loot_items:
        wiki_title = find_wiki_title(item.name, wiki_titles)
        candidate = Candidate(
            loot_item=item,
            name=item.name,
            wiki_title=wiki_title,
        )
        candidates.append(candidate)
        seen.add(normalize_key(item.name))
        if wiki_title:
            seen.add(normalize_key(wiki_title))

    for title in wiki_titles:
        canonical_name = canonical_name_from_title(title)
        key = normalize_key(canonical_name)
        if key in seen:
            continue
        candidates.append(
            Candidate(
                loot_item=None,
                name=canonical_name,
                wiki_title=title,
            )
        )
        seen.add(key)

    candidates.sort(key=lambda candidate: (candidate.name.lower(), candidate.wiki_title or ""))
    if args.limit and args.limit > 0:
        candidates = candidates[: args.limit]

    written = 0
    wiki_only = 0
    with_wiki = 0
    created: List[str] = []
    failures: List[str] = []

    for candidate in candidates:
        slug = candidate.loot_item.slug if candidate.loot_item else slugify(candidate.name)
        try:
            doc = build_doc(candidate, slug)
        except Exception as exc:
            failures.append(f"{candidate.name}: {exc}")
            continue

        if candidate.loot_item is None:
            wiki_only += 1
        if doc["resources"].get("wiki"):
            with_wiki += 1

        output_path = OUTPUT_DIR / f"{slug}.json"
        output_path.write_text(f"{json.dumps(doc, indent=2, ensure_ascii=True)}\n", encoding="utf-8")
        created.append(output_path.name)
        written += 1

    report = {
        "lootlemon_items": len(loot_items),
        "wiki_category_members": len(wiki_titles_all),
        "wiki_candidates_after_filter": len(wiki_titles),
        "written": written,
        "wiki_only_written": wiki_only,
        "with_wiki_url": with_wiki,
        "created_files": created,
        "failures": failures,
    }
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))

    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
