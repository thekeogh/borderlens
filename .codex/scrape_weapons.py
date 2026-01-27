#!/usr/bin/env python3
"""Scrape weapon data from Lootlemon + wiki into local JSON files.

Usage:
  python3 .codex/scrape_weapons.py
"""

import json
import re
from collections import OrderedDict
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/borderlands/weapons/json"
FILES = sorted([p.name for p in DATA_DIR.glob("*.json")])

CONTENT_MAP = {
    "General Knoxx": "The Secret Armory of General Knoxx",
    "Knoxx": "The Secret Armory of General Knoxx",
    "Dr. Ned": "The Zombie Island of Dr. Ned",
    "Zombie Island": "The Zombie Island of Dr. Ned",
    "Mad Moxxi": "Mad Moxxi's Underdome Riot",
    "Claptrap": "Claptrap's New Robot Revolution",
}

CONTENT_ENUM = {
    "Base Game",
    "The Zombie Island of Dr. Ned",
    "Mad Moxxi's Underdome Riot",
    "The Secret Armory of General Knoxx",
    "Claptrap's New Robot Revolution",
    "Enhanced",
}

MANUFACTURERS = {
    "Atlas",
    "Dahl",
    "Eridian",
    "Hyperion",
    "Jakobs",
    "Maliwan",
    "S&S Munitions",
    "Tediore",
    "Torgue",
    "Vladof",
}

ELEMENTS = ["Incendiary", "Corrosive", "Shock", "Explosive"]

ORDER = [
    "content",
    "dlc",
    "images",
    "resources",
    "name",
    "type",
    "description",
    "manufacturer",
    "elements",
    "multiplier",
    "rarity",
    "special",
    "ranges",
    "parts",
    "max",
    "source",
]

BAD_MODIFIERS = {"\u00e2\u0080\u008d", "\u200d"}

session = requests.Session()


def fetch(url):
    return session.get(url, timeout=30).text


def parse_lootlemon(url):
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    data = {}
    data["content"] = soup.select_one("#item-origin").get_text(strip=True)
    data["name"] = soup.select_one("h1.article_heading span:nth-of-type(2)").get_text(strip=True)
    data["type"] = soup.select_one("#item-type").get_text(strip=True)
    data["manufacturer"] = soup.select_one("#item-manufacturer").get_text(strip=True)
    data["rarity"] = soup.select_one("#item-rarity").get_text(strip=True)
    red = soup.select_one("#red-text")
    data["red"] = red.get_text(" ", strip=True) if red else None

    # about
    about = None
    details = next((p for p in soup.select(".w-tab-pane") if p.get("data-w-tab") == "Details"), None)
    if details:
        h3 = next((h for h in details.find_all("h3") if "About" in h.get_text()), None)
        if h3:
            div = h3.find_parent().find_next_sibling("div")
            if div:
                about = div.get_text(" ", strip=True)
    data["about"] = about

    # unique ability
    unique = None
    if details:
        h4 = next((h for h in details.find_all("h4") if "Unique Ability" in h.get_text()), None)
        if h4:
            rich = h4.find_parent().find_next_sibling("div")
            if rich:
                unique = rich.get_text(" ", strip=True)
    data["unique"] = unique

    # elements from icons
    elements = []
    for img in soup.select(".stat_value-icon-grid > div img"):
        src = img.get("src", "")
        if not src:
            continue
        name = src.split("/")[-1]
        if "Non-Elemental" in name:
            continue
        if "Incindiary" in name:
            elements.append("Incendiary")
        elif "Shock" in name:
            elements.append("Shock")
        elif "Corrosive" in name:
            elements.append("Corrosive")
        elif "Explosive" in name:
            elements.append("Explosive")
    data["elements"] = elements

    # parts
    parts_div = soup.select_one("div.rich-txt_parts-new")
    parts = {}
    if parts_div:
        for h4 in parts_div.find_all("h4"):
            category = h4.get_text(strip=True)
            ul = h4.find_next_sibling("ul")
            if not ul:
                continue
            entries = []
            for li in ul.find_all("li"):
                text = li.get_text("\n", strip=True)
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                if not lines:
                    continue
                entries.append({"name": lines[0], "modifiers": lines[1:]})
            parts[category] = entries
    data["parts"] = parts

    # sources
    sources = []
    for card in soup.select("#loot-source-grid .card"):
        title = card.select_one(".card_details h3")
        name = title.get_text(strip=True) if title else card.get_text(" ", strip=True)
        tags = [t.get_text(" ", strip=True) for t in card.select(".card_tag")]
        sources.append({"name": name, "tags": tags})
    data["sources"] = sources

    return data


def parse_wiki(url):
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    desc = None
    for header in soup.select(".mw-parser-output > h2"):
        title = header.get_text(" ", strip=True)
        if re.search(r"(Usage|Description)", title, re.I):
            p = header.find_next_sibling("p")
            if p:
                desc = p.get_text(" ", strip=True)
            break

    el = soup.select_one("div[data-source=\"element\"] div.pi-data-value span")
    element_text = el.get_text(" ", strip=True) if el else None

    stats = {}
    for h3 in soup.select("h3.pi-data-label"):
        label = h3.get_text(" ", strip=True)
        if re.search(r"Damage|Accuracy|Fire Rate|Magazine Capacity", label, re.I):
            val = h3.find_next_sibling("div", class_="pi-data-value")
            if val:
                stats[label] = val.get_text(" ", strip=True)

    special = None
    for p in soup.select(".mw-parser-output p"):
        if p.find("span", class_="text-flavor"):
            p.find("span", class_="text-flavor").extract()
            special = p.get_text(" ", strip=True)
            break

    return {"desc": desc, "element_text": element_text, "stats": stats, "special": special}


def normalize_content(content):
    if content in CONTENT_ENUM:
        return content
    return CONTENT_MAP.get(content, content)


def normalize_manufacturer(name):
    if name in MANUFACTURERS:
        return name
    for m in MANUFACTURERS:
        if m.lower() == name.lower():
            return m
    return name


def parse_range(text):
    if not text:
        return None
    t = text.replace("\xa0", " ").replace(",", "")
    nums = re.findall(r"\d+\.?\d*", t)
    if nums:
        if len(nums) == 1:
            return [float(nums[0])]
        return [float(nums[0]), float(nums[-1])]
    return None


def parse_multiplier(text):
    if not text:
        return None
    nums = [float(n) for n in re.findall(r"×\s*(\d+(?:\.\d+)?)", text)]
    if not nums:
        return None
    if len(nums) == 1:
        return [nums[0]]
    return [nums[0], nums[-1]]


def parse_elements_from_wiki(text):
    if not text:
        return []
    if "any" in text.lower():
        return ELEMENTS
    found = []
    for el in ELEMENTS:
        if el.lower() in text.lower():
            found.append(el)
    return found


def order_parts(parts):
    if not parts:
        return None
    ordered = OrderedDict()
    for key in ["Body", "Barrel", "Magazine", "Stock", "Sight", "Accessory", "Material"]:
        if key == "Accessory":
            for k in list(parts.keys()):
                if k.startswith("Accessory"):
                    ordered["Accessory"] = parts[k]
                    break
            continue
        if key in parts:
            ordered[key] = parts[key]
    return ordered if ordered else None


def is_bad_modifier(text):
    if not text:
        return True
    if text in BAD_MODIFIERS:
        return True
    cleaned = re.sub(r"[A-Za-z0-9%+\-().x/ ]+", "", text)
    return cleaned == "" and text.strip() == ""


def summarize_traits(text):
    if not text:
        return [], []
    t = text.lower()
    positives = []
    negatives = []

    def add(lst, phrase):
        if phrase not in lst:
            lst.append(phrase)

    def has_any(*words):
        return any(w in t for w in words)

    if has_any("accuracy"):
        if has_any("low accuracy", "poor accuracy", "less accurate", "reduced accuracy"):
            add(negatives, "lower accuracy")
        else:
            add(positives, "notable accuracy")
    if has_any("damage"):
        if has_any("low damage", "reduced damage", "less damage"):
            add(negatives, "lower damage")
        else:
            add(positives, "strong damage")
    if has_any("fire rate"):
        if has_any("slow fire rate", "reduced fire rate", "lower fire rate"):
            add(negatives, "slower fire rate")
        else:
            add(positives, "fast fire rate")
    if has_any("magazine", "mag size"):
        if has_any("small magazine", "lower magazine", "reduced magazine"):
            add(negatives, "smaller magazine")
        else:
            add(positives, "large magazine")
    if has_any("reload"):
        if has_any("slow reload", "reduced reload", "long reload"):
            add(negatives, "slower reload")
        else:
            add(positives, "quick reload")
    if has_any("recoil"):
        if has_any("more recoil", "increased recoil", "higher recoil"):
            add(negatives, "heavier recoil")
        else:
            add(positives, "manageable recoil")
    if has_any("spread"):
        if has_any("wider spread", "broader spread", "more spread"):
            add(negatives, "wider spread")
        else:
            add(positives, "tighter spread")
    if has_any("crit", "critical"):
        add(positives, "critical hit bonus")
    if has_any("element"):
        add(positives, "elemental potential")
    if has_any("zoom"):
        add(positives, "high zoom scope")
    if has_any("projectile speed", "velocity"):
        if has_any("slow"):
            add(negatives, "slow projectiles")
        else:
            add(positives, "fast projectiles")
    if has_any("ammo regen", "regenerate ammo", "ammo regeneration"):
        add(positives, "ammo regeneration")
    if has_any("burst"):
        add(positives, "burst-fire behavior")
    if has_any("explosion", "explode", "splash"):
        add(positives, "explosive splash")

    return positives[:3], negatives[:2]


def behavior_sentence(text):
    if not text:
        return None
    t = text.lower()
    phrases = []
    if "burst" in t:
        phrases.append("fires in bursts")
    if "semi-auto" in t or "semi auto" in t:
        phrases.append("fires semi-auto")
    if "full-auto" in t or "full auto" in t:
        phrases.append("fires full-auto")
    if "explosion" in t or "explode" in t or "splash" in t:
        phrases.append("shots explode on impact")
    if "ammo regen" in t or "ammo regeneration" in t:
        phrases.append("regenerates ammo over time")
    if "transfusion" in t or "orb" in t:
        phrases.append("creates healing orbs on hit")
    if "hybrid" in t:
        phrases.append("can combine into a hybrid weapon")
    if "carnage barrel" in t:
        phrases.append("can roll a carnage barrel that fires a single heavy shot")
    if "unloads its entire magazine" in t or "unloads the entire magazine" in t:
        phrases.append("dumps the full magazine when scoped")
    if "projectile" in t and "slow" in t:
        phrases.append("launches a slow projectile")
    if "zoom" in t:
        phrases.append("features unusually high zoom")
    if "chance to deal" in t and ("fire" in t and "shock" in t and "corrosive" in t):
        phrases.append("can swap between multiple elements")

    if not phrases:
        return None
    phrase = " and ".join(phrases[:2])
    return f"It {phrase}."


def reword_description(name, rarity, manufacturer, wtype, content, wiki_desc, unique_text):
    intro = None
    if name and rarity and manufacturer and wtype and content:
        intro = f"The {name} is a {rarity} {manufacturer} {wtype} from {content}."
    elif name and wtype and content:
        intro = f"The {name} is a {wtype} from {content}."
    positives, negatives = summarize_traits((wiki_desc or "") + " " + (unique_text or ""))
    summary_parts = []
    if positives:
        summary_parts.append("known for " + ", ".join(positives))
    if negatives:
        summary_parts.append("but with " + " and ".join(negatives))
    summary = None
    if summary_parts:
        summary = "It is " + " ".join(summary_parts) + "."

    behavior = behavior_sentence((wiki_desc or "") + " " + (unique_text or ""))
    pieces = [p for p in [intro, summary, behavior] if p]
    return " ".join(pieces) if pieces else None


def reword_special(unique_text, wiki_special):
    positives, negatives = summarize_traits((unique_text or "") + " " + (wiki_special or ""))
    parts = []
    if positives:
        parts.append("Boosts " + ", ".join(positives))
    if negatives:
        parts.append("but has " + " and ".join(negatives))
    base = None
    if parts:
        base = " ".join(parts) + "."
    behavior = behavior_sentence((unique_text or "") + " " + (wiki_special or ""))
    if base and behavior:
        return f"{base} {behavior}"
    return base or behavior


def clean_grammar(text):
    if not isinstance(text, str):
        return text
    text = text.replace("Eridian Eridian", "Eridian weapon")
    text = text.replace("It shots", "Its shots")
    text = text.replace("and dumping", "and dumps")
    text = text.replace("but lowers slow ", "but has slow ")
    text = text.replace("but lowers slower ", "but has a slower ")
    text = text.replace("but lowers lower ", "but has lower ")
    text = text.replace("but lowers wider ", "but has wider ")
    text = text.replace("but lowers heavier ", "but has heavier ")
    text = text.replace("but lowers smaller ", "but has smaller ")
    text = text.replace("but lowers faster ", "but has faster ")
    return text


for fname in FILES:
    path = DATA_DIR / fname
    with path.open() as f:
        existing = json.load(f)

    resources = existing.get("resources", {})
    loot_url = resources.get("lootlemon")
    wiki_url = resources.get("wiki")
    if not loot_url or not wiki_url:
        continue

    loot = parse_lootlemon(loot_url)
    wiki = parse_wiki(wiki_url)

    content = existing.get("content")
    if content not in CONTENT_ENUM:
        content = normalize_content(content or loot.get("content"))

    dlc = existing.get("dlc") if "dlc" in existing else (content != "Base Game")

    name = existing.get("name") or loot.get("name")
    wtype = existing.get("type") or loot.get("type")

    description = existing.get("description")
    if not description:
        description = reword_description(
            name,
            loot.get("rarity"),
            normalize_manufacturer(loot.get("manufacturer")),
            wtype,
            content,
            wiki.get("desc"),
            loot.get("unique"),
        )
    description = clean_grammar(description)

    manufacturer = existing.get("manufacturer")
    if not manufacturer:
        manufacturer = [normalize_manufacturer(loot.get("manufacturer"))]

    elements = existing.get("elements")
    if elements is None:
        elements = loot.get("elements") or parse_elements_from_wiki(wiki.get("element_text"))
        elements = [e for e in elements if e in ELEMENTS]
        if not elements:
            elements = None

    multiplier = existing.get("multiplier")
    if multiplier is None:
        multiplier = parse_multiplier(wiki.get("element_text"))

    rarity = existing.get("rarity")
    if not rarity:
        rarity = [loot.get("rarity")] if loot.get("rarity") else None

    special = existing.get("special")
    if not special and loot.get("red"):
        special_desc = reword_special(loot.get("unique"), wiki.get("special"))
        if special_desc:
            special = {"red": loot.get("red"), "description": clean_grammar(special_desc)}

    ranges = existing.get("ranges")
    if not ranges:
        stats = wiki.get("stats") or {}
        ranges = {}
        for label, key in [
            ("Damage", "damage"),
            ("Accuracy", "accuracy"),
            ("Fire Rate", "rate"),
            ("Magazine Capacity", "mag"),
        ]:
            for s_label, s_val in stats.items():
                if label.lower() in s_label.lower():
                    parsed = parse_range(s_val)
                    if parsed:
                        ranges[key] = parsed
        if not ranges:
            ranges = None

    parts = existing.get("parts")
    if not parts:
        parts = order_parts(loot.get("parts"))

    if isinstance(parts, dict):
        for entries in parts.values():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                mods = entry.get("modifiers")
                if isinstance(mods, list):
                    entry["modifiers"] = [m for m in mods if m and not is_bad_modifier(m)]

    source = existing.get("source")
    if not source:
        source = loot.get("sources") or None

    ordered = OrderedDict()
    for key in ORDER:
        if key == "content":
            ordered["content"] = content
        elif key == "dlc":
            ordered["dlc"] = dlc
        elif key == "images" and "images" in existing:
            ordered["images"] = existing["images"]
        elif key == "resources" and "resources" in existing:
            ordered["resources"] = existing["resources"]
        elif key == "name":
            ordered["name"] = name
        elif key == "type":
            ordered["type"] = wtype
        elif key == "description" and description:
            ordered["description"] = description
        elif key == "manufacturer" and manufacturer:
            ordered["manufacturer"] = manufacturer
        elif key == "elements" and elements is not None:
            ordered["elements"] = elements
        elif key == "multiplier" and multiplier is not None:
            ordered["multiplier"] = multiplier
        elif key == "rarity" and rarity:
            ordered["rarity"] = rarity
        elif key == "special" and special:
            ordered["special"] = special
        elif key == "ranges" and ranges:
            ordered["ranges"] = ranges
        elif key == "parts" and parts:
            ordered["parts"] = parts
        elif key == "max" and "max" in existing:
            ordered["max"] = existing["max"]
        elif key == "source" and source:
            ordered["source"] = source

    with path.open("w") as f:
        json.dump(ordered, f, indent=2)
        f.write("\n")

print("done")
