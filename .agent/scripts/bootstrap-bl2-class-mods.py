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

LOOTLEMON_LIST_URL = "https://www.lootlemon.com/db/borderlands-2/class-mods"
WIKI_API_URL = "https://borderlands.fandom.com/api.php"
WIKI_CATEGORY_TITLE = "Category:Class_Mods_in_Borderlands_2"

OUTPUT_DIR = Path("data/games/borderlands2/class-mods")
REPORT_DIR = Path(".agent/bl2/class-mods")
REPORT_PATH = REPORT_DIR / "bootstrap-report.json"

CONTENT_MAP: Dict[str, str] = {
    "base-game-bl2": "Base Game",
    "mechromancer-feature-pack": "Mechromancer Pack",
    "psycho-feature-pack": "Psycho Pack",
    "dragon-keep-dlc": "Tiny Tina's Assault on Dragon Keep",
    "digistruct-peak-feature-pack": "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge",
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

CLASS_MAP: Dict[str, str] = {
    "axton": "Commando",
    "gaige": "Mechromancer",
    "krieg": "Psycho",
    "maya": "Siren",
    "salvador": "Gunzerker",
    "zer0": "Assassin",
}

CLASS_SLUG_MAP: Dict[str, str] = {
    "Assassin": "assassin",
    "Commando": "commando",
    "Gunzerker": "gunzerker",
    "Mechromancer": "mechromancer",
    "Psycho": "psycho",
    "Siren": "siren",
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

WIKI_TITLE_OVERRIDES: Dict[str, str] = {
    "Slayer Of Terramorphous": "Slayer Of Terramorphous",
}

WIKI_ONLY_CLASS_FALLBACK: Dict[str, str] = {
    "Binder": "Siren",
    "Cat": "Siren",
    "Engineer": "Commando",
    "Hoarder": "Gunzerker",
    "Ninja": "Assassin",
    "Nurse": "Siren",
    "Pointman": "Commando",
    "Roboteer": "Mechromancer",
    "Sickle": "Psycho",
    "Sniper": "Assassin",
    "Titan": "Commando",
    "Torch": "Psycho",
}

SKILL_NORMALIZATION: Dict[str, str] = {
    "Tw0 Fang": "Tw0Fang",
    "Unf0reseen": "Unf0rseen",
}


@dataclass
class LootlemonItem:
    class_name: str
    class_slug: str
    content_slug: str
    detail_url: str
    manufacturer_slug: str
    name: str
    rarity_slug: str


@dataclass
class Candidate:
    class_name: str
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


def normalize_skill_name(value: str) -> str:
    cleaned = clean_text(value)
    return SKILL_NORMALIZATION.get(cleaned, cleaned)


def normalize_key(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\s*\(class mod\)\s*", "", value)
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


def extract_wiki_skill_links(wikitext: str) -> List[str]:
    match = re.search(
        r"=+\s*Skill Bonus(?:es)?\s*=+([\s\S]*?)(?=\n==|\n\{\{|$)",
        wikitext,
        re.IGNORECASE,
    )
    if not match:
        return []

    section = match.group(1)
    values: List[str] = []
    for link in re.finditer(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", section):
        display = clean_text(link.group(2) or link.group(1))
        display = display.split("#")[0].strip()
        display = re.sub(r"\s*\(.*?\)\s*", "", display).strip()
        display = normalize_skill_name(display)
        if display and display not in values:
            values.append(display)
    return values


def parse_wiki_class_from_wikitext(wikitext: str) -> Optional[str]:
    template_map = {
        "axton": "Commando",
        "maya": "Siren",
        "salvador": "Gunzerker",
        "gaige": "Mechromancer",
        "krieg": "Psycho",
        "zer0": "Assassin",
        "assasin": "Assassin",
    }
    for token, class_name in template_map.items():
        if re.search(rf"\{{\{{\s*{re.escape(token)}com2\s*\}}\}}", wikitext, re.IGNORECASE):
            return class_name
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
        manufacturer_slug = clean_text(node.get("data-manufacturer", ""))
        class_slug = clean_text(node.get("data-class", "")).lower()

        if class_slug not in CLASS_MAP:
            continue

        overlay = node.select_one("a.link-overlay")
        if not overlay:
            continue

        href = clean_text(overlay.get("href", ""))
        if not href.startswith("/class-mod/"):
            continue

        detail_url = f"https://www.lootlemon.com{href}"
        class_name = CLASS_MAP[class_slug]

        # Normalize casing inconsistency from listing for this family.
        if name.lower().startswith("slayer of terramorphous"):
            name = "Slayer Of Terramorphous"

        items.append(
            LootlemonItem(
                class_name=class_name,
                class_slug=class_slug,
                content_slug=content_slug,
                detail_url=detail_url,
                manufacturer_slug=manufacturer_slug,
                name=name,
                rarity_slug=rarity_slug,
            )
        )

    items.sort(key=lambda item: (item.name.lower(), item.class_name.lower(), item.detail_url))
    return items


def canonical_name_from_title(title: str) -> str:
    name = re.sub(r"\s*\(class mod\)\s*", "", title, flags=re.IGNORECASE)
    name = re.sub(r"\s*\(borderlands 2\)\s*", "", name, flags=re.IGNORECASE)
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

    skills: List[str] = []
    skill_images = loot_soup.select(
        ".w-tab-pane[data-w-tab='Skills'] .margin-bottom .article_skill-grid .card.skill.w-dyn-item img[alt]"
    )
    for img in skill_images:
        alt = clean_text(img.get("alt", ""))
        if not alt:
            continue
        # Alt is like "Annoyed Android (Gaige)"
        skill_name = normalize_skill_name(alt.rsplit(" (", 1)[0].strip())
        if skill_name and skill_name not in skills:
            skills.append(skill_name)

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
        "skills": skills,
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
            "Special Class Mod Effect",
            "Special Class Mod Effects",
            "Special Weapon Effects",
        ],
    )
    intro = extract_intro_text(soup)

    wikitext = parsed.get("wikitext", "")
    fields = parse_wikitext_fields(wikitext)
    wiki_skills = extract_wiki_skill_links(wikitext)
    wiki_class = parse_wiki_class_from_wikitext(wikitext)

    if not special:
        for heading in (
            "Special Class Mod Effects",
            "Special Class Mod Effect",
            "Special Effects",
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
        "intro": intro,
        "notes": clean_multiline("\n".join([part for part in [notes, trivia] if part])),
        "special": special,
        "usage": usage,
        "wiki_class": wiki_class,
        "wiki_skills": wiki_skills,
        "wiki_url": wiki_url,
    }


def resolve_class_name(
    name: str,
    loot_item: Optional[LootlemonItem],
    wiki_details: dict,
    legendary_map: Dict[str, str],
) -> Optional[str]:
    if loot_item:
        return loot_item.class_name

    if wiki_details.get("wiki_class"):
        return wiki_details["wiki_class"]

    clean_name = canonical_name_from_title(name)
    if clean_name in WIKI_ONLY_CLASS_FALLBACK:
        return WIKI_ONLY_CLASS_FALLBACK[clean_name]
    if clean_name in legendary_map:
        return legendary_map[clean_name]

    return None


def build_doc(
    candidate: Candidate,
    slug: str,
    legendary_map: Dict[str, str],
) -> dict:
    loot = scrape_lootlemon_details(candidate.loot_item) if candidate.loot_item else {
        "about_text": "",
        "red_text": "",
        "skills": [],
        "sources": [],
        "special_text": "",
    }

    wiki = scrape_wiki_details(candidate.wiki_title) if candidate.wiki_title else {
        "fields": {},
        "intro": "",
        "notes": "",
        "special": "",
        "usage": "",
        "wiki_class": None,
        "wiki_skills": [],
        "wiki_url": None,
    }

    class_name = resolve_class_name(candidate.name, candidate.loot_item, wiki, legendary_map)
    if not class_name:
        raise RuntimeError(f"Unable to determine class type for {candidate.name}")

    fields = wiki["fields"]

    content = "Base Game"
    if candidate.loot_item:
        content = CONTENT_MAP.get(candidate.loot_item.content_slug, "Base Game")

    if candidate.loot_item:
        rarity_value = RARITY_MAP.get(candidate.loot_item.rarity_slug, "Epic")
        if rarity_value == "Epic":
            rarities = ["Common", "Uncommon", "Rare", "Epic"]
        else:
            rarities = [rarity_value]
    else:
        rarities = parse_wiki_rarities(fields.get("rarity", ""), fields.get("color", ""))
        if not rarities:
            rarities = ["Common", "Uncommon", "Rare", "Epic"]

    manufacturers: List[str] = []
    if candidate.loot_item:
        mapped = MANUFACTURER_MAP.get(candidate.loot_item.manufacturer_slug.lower())
        if mapped:
            manufacturers.append(mapped)
    if not manufacturers:
        manufacturers = parse_wiki_manufacturers(fields.get("manufacturer", ""))
    if not manufacturers:
        raise RuntimeError(f"Unable to determine manufacturers for {candidate.name}")

    description = sanitize_narrative(
        "\n".join(part for part in [loot["about_text"], wiki["usage"], wiki["intro"]] if part)
    )
    if not description:
        description = clean_text(f"{candidate.name} is a Borderlands 2 class mod for {class_name}.")

    skills = []
    for skill in loot["skills"] + wiki["wiki_skills"]:
        if skill and skill not in skills:
            skills.append(skill)

    notes = sanitize_narrative(wiki["notes"])
    special_description = clean_multiline(
        "\n".join(part for part in [loot["special_text"], wiki["special"]] if part)
    )
    red_text = loot["red_text"]

    resources: Dict[str, str] = {}
    if candidate.loot_item:
        resources["lootlemon"] = candidate.loot_item.detail_url
    if wiki.get("wiki_url"):
        resources["wiki"] = wiki["wiki_url"]

    doc: Dict[str, object] = {
        "category": "class-mods",
        "content": content,
        "dlc": content != "Base Game",
        "image": f"/img/games/borderlands2/class-mods/{slug}.png",
        "resources": resources,
        "name": candidate.name,
        "slug": slug,
        "type": class_name,
        "description": description,
        "manufacturers": manufacturers,
        "rarities": rarities,
    }

    if skills:
        doc["skills"] = skills

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


def main() -> None:
    args = parse_args()
    ensure_dirs()

    loot_items = parse_lootlemon_list()
    wiki_titles = get_wiki_category_titles()

    # Map used to infer wiki-only class ownership from legendary equivalents.
    legendary_class_map: Dict[str, str] = {}
    for item in loot_items:
        if item.name.lower().startswith("legendary "):
            base = item.name[len("Legendary ") :].strip()
            legendary_class_map[base] = item.class_name

    candidates: List[Candidate] = []
    loot_norm_set = set()

    for item in loot_items:
        wiki_title = find_wiki_title(item.name, wiki_titles)
        candidates.append(
            Candidate(
                class_name=item.class_name,
                loot_item=item,
                name=item.name,
                wiki_title=wiki_title,
            )
        )
        loot_norm_set.add(normalize_key(item.name))

    # Wiki-only additions (mostly non-legendary variants not covered by Lootlemon listing).
    for title in wiki_titles:
        canonical_name = canonical_name_from_title(title)
        key = normalize_key(canonical_name)
        if key in loot_norm_set:
            continue

        candidates.append(
            Candidate(
                class_name="",
                loot_item=None,
                name=canonical_name,
                wiki_title=title,
            )
        )
        loot_norm_set.add(key)

    # Determine duplicate names (for slug disambiguation only).
    name_counts: Dict[str, int] = {}
    for candidate in candidates:
        key = normalize_key(candidate.name)
        name_counts[key] = name_counts.get(key, 0) + 1

    # Deterministic order.
    candidates.sort(
        key=lambda candidate: (
            candidate.name.lower(),
            (candidate.loot_item.class_name.lower() if candidate.loot_item else ""),
            candidate.wiki_title or "",
        )
    )

    if args.limit and args.limit > 0:
        candidates = candidates[: args.limit]

    written = 0
    wiki_only = 0
    with_wiki = 0
    created: List[str] = []
    all_skills: List[str] = []
    failures: List[str] = []

    for candidate in candidates:
        class_name_for_slug = candidate.loot_item.class_name if candidate.loot_item else (
            WIKI_ONLY_CLASS_FALLBACK.get(candidate.name)
            or legendary_class_map.get(candidate.name)
            or "class"
        )
        base_slug = slugify(candidate.name)
        if name_counts.get(normalize_key(candidate.name), 0) > 1:
            base_slug = f"{base_slug}-{CLASS_SLUG_MAP.get(class_name_for_slug, slugify(class_name_for_slug))}"

        try:
            doc = build_doc(candidate, base_slug, legendary_class_map)
        except Exception as exc:
            failures.append(f"{candidate.name}: {exc}")
            continue

        if candidate.loot_item is None:
            wiki_only += 1
        if doc["resources"].get("wiki"):
            with_wiki += 1

        output_path = OUTPUT_DIR / f"{base_slug}.json"
        output_path.write_text(f"{json.dumps(doc, indent=2, ensure_ascii=True)}\n", encoding="utf-8")
        created.append(output_path.name)
        for skill in doc.get("skills", []):
            if skill not in all_skills:
                all_skills.append(skill)
        written += 1

    report = {
        "lootlemon_items": len(loot_items),
        "wiki_category_members": len(wiki_titles),
        "written": written,
        "wiki_only_written": wiki_only,
        "with_wiki_url": with_wiki,
        "created_files": created,
        "skill_count": len(all_skills),
        "skills": sorted(all_skills),
        "failures": failures,
    }
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))

    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
