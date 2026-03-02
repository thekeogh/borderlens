#!/usr/bin/env python3
import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qs, urlparse, unquote

import requests
from bs4 import BeautifulSoup

USER_AGENT = {"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"}
WIKI_API_URL = "https://borderlands.fandom.com/api.php"

CATEGORIES = ["weapons", "shields", "grenade-mods"]
DATA_ROOT = Path("data/games/borderlands2")

ELEMENT_ORDER = ["None", "Incendiary", "Shock", "Corrosive", "Slag", "Explosive"]

ALT_TO_ELEMENT = {
    "non-elemental": "None",
    "none": "None",
    "fire": "Incendiary",
    "incendiary": "Incendiary",
    "incindiary": "Incendiary",
    "shock": "Shock",
    "corrosive": "Corrosive",
    "slag": "Slag",
    "explosive": "Explosive",
}

TOKEN_TO_ELEMENT = {
    "none": "None",
    "non-elemental": "None",
    "non elemental": "None",
    "nonelemental": "None",
    "fire": "Incendiary",
    "incendiary": "Incendiary",
    "incindiary": "Incendiary",
    "shock": "Shock",
    "corrosive": "Corrosive",
    "slag": "Slag",
    "explosive": "Explosive",
}

http_cache: Dict[str, str] = {}


def fetch_text(url: str) -> str:
    cached = http_cache.get(url)
    if cached is not None:
        return cached
    response = requests.get(url, headers=USER_AGENT, timeout=30)
    response.raise_for_status()
    http_cache[url] = response.text
    return response.text


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_alt(value: str) -> str:
    return normalize_space(value).lower().replace("_", "-")


def sort_elements(values: List[str]) -> List[str]:
    unique = []
    for value in values:
        if value not in unique:
            unique.append(value)
    rank = {name: index for index, name in enumerate(ELEMENT_ORDER)}
    return sorted(unique, key=lambda value: rank.get(value, 999))


def map_text_to_elements(raw: str) -> List[str]:
    text = normalize_space(raw).lower()
    if not text:
        return []

    # Wiki "Any" is treated as all elemental + non-elemental variants.
    if re.search(r"\bany\b", text):
        return ELEMENT_ORDER.copy()

    found: List[str] = []
    for token, mapped in TOKEN_TO_ELEMENT.items():
        if token in text and mapped not in found:
            found.append(mapped)
    return sort_elements(found)


def strip_wiki_markup(value: str) -> str:
    text = value
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = text.replace("{{dash}}", "-")
    text = re.sub(r"'''+", "", text)
    text = re.sub(r"''", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return normalize_space(text)


def extract_lootlemon_elements(lootlemon_url: str) -> List[str]:
    html = fetch_text(lootlemon_url)
    soup = BeautifulSoup(html, "html.parser")

    found: List[str] = []
    for image in soup.select("img.icon-round[alt]"):
        alt = normalize_alt(image.get("alt", ""))
        mapped = ALT_TO_ELEMENT.get(alt)
        if mapped and mapped not in found:
            found.append(mapped)

    return sort_elements(found)


def wiki_title_from_url(wiki_url: str) -> Optional[str]:
    try:
        parsed = urlparse(wiki_url)
    except Exception:
        return None

    query_title = parse_qs(parsed.query).get("title")
    if query_title:
        return unquote(query_title[0]).replace("_", " ")

    match = re.search(r"/wiki/(.+)$", parsed.path)
    if match:
        return unquote(match.group(1)).replace("_", " ")
    return None


def extract_wiki_elements(wiki_url: str) -> List[str]:
    title = wiki_title_from_url(wiki_url)
    if not title:
        return []

    response = requests.get(
        WIKI_API_URL,
        params={
            "action": "parse",
            "format": "json",
            "formatversion": "2",
            "prop": "wikitext",
            "page": title,
            "redirects": "1",
        },
        headers=USER_AGENT,
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    wikitext = payload.get("parse", {}).get("wikitext", "")
    if not wikitext:
        return []

    candidates: List[str] = []
    for raw_line in wikitext.splitlines():
        line = raw_line.strip()
        if not line.startswith("|") or "=" not in line:
            continue
        key, value = line[1:].split("=", 1)
        key = normalize_space(key).lower().replace(" ", "_")
        if key.startswith("element"):
            candidates.append(strip_wiki_markup(value))

    found: List[str] = []
    for raw in candidates:
        for element in map_text_to_elements(raw):
            if element not in found:
                found.append(element)
    return sort_elements(found)


def main() -> None:
    total = 0
    changed = 0
    none_added = 0
    by_category = Counter()
    source_counter = Counter()

    for category in CATEGORIES:
        category_dir = DATA_ROOT / category
        for json_path in sorted(category_dir.glob("*.json")):
            total += 1
            item = json.loads(json_path.read_text(encoding="utf-8"))
            resources = item.get("resources") or {}

            existing = sort_elements(item.get("elements", [])) if item.get("elements") else []
            extracted: List[str] = []
            evidence_source = "none"

            lootlemon_url = resources.get("lootlemon")
            wiki_url = resources.get("wiki")

            if lootlemon_url:
                extracted = extract_lootlemon_elements(lootlemon_url)
                if extracted:
                    evidence_source = "lootlemon"
            if not extracted and wiki_url:
                extracted = extract_wiki_elements(wiki_url)
                if extracted:
                    evidence_source = "wiki"

            next_elements = extracted if extracted else existing
            if next_elements:
                item["elements"] = next_elements
            elif "elements" in item:
                del item["elements"]

            if existing != next_elements:
                changed += 1
                if "None" in next_elements and "None" not in existing:
                    none_added += 1
                by_category[category] += 1
                source_counter[evidence_source] += 1
                json_path.write_text(
                    f"{json.dumps(item, indent=2, ensure_ascii=True)}\n",
                    encoding="utf-8",
                )

    report = {
        "scanned": total,
        "changed": changed,
        "none_added": none_added,
        "changed_by_category": dict(by_category),
        "changed_by_source": dict(source_counter),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
