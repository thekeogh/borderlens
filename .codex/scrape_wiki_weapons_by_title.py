#!/usr/bin/env python3
"""Scrape selected wiki weapons by title from the category page.

Usage:
  python3 .codex/scrape_wiki_weapons_by_title.py "Brute" "Carnage" ...

The script resolves partial titles against the category list, scrapes wiki-only
fields, downloads the card image, and infers max rarity from the title color.
"""

import json
import os
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/borderlands/weapons/json"
IMG_DIR = ROOT / "data/borderlands/weapons/img/card"
CATEGORY_URL = "https://borderlands.fandom.com/wiki/Category:Weapons_in_Borderlands"

MANUFACTURERS = [
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
]

WEAPON_TYPES = {
    "Repeater": "Repeater",
    "Repeater Pistol": "Repeater",
    "Revolver": "Revolver",
    "SMG": "SMG",
    "Submachine Gun": "SMG",
    "Combat Rifle": "Assault Rifle",
    "Assault Rifle": "Assault Rifle",
    "Shotgun": "Shotgun",
    "Combat Shotgun": "Shotgun",
    "Assault Shotgun": "Shotgun",
    "Sniper": "Sniper",
    "Sniper Rifle": "Sniper",
    "Pump-Action Sniper Rifle": "Sniper",
    "Semi-Automatic Sniper Rifle": "Sniper",
    "Rocket Launcher": "Launcher",
    "Launcher": "Launcher",
    "Eridian": "Eridian",
    "Support Machine Gun": "Assault Rifle",
    "Burst Rifle": "Assault Rifle",
}

ORDER = [
    "content",
    "dlc",
    "images",
    "resources",
    "name",
    "type",
    "description",
    "notes",
    "manufacturer",
    "elements",
    "multiplier",
    "rarity",
    "ranges",
    "parts",
    "max",
    "source",
]

session = requests.Session()


def fetch(url):
    return session.get(url, timeout=30).text


def normalize_name(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def strip_parenthetical(title):
    return re.sub(r"\s*\([^)]*\)\s*", " ", title).strip()


def slugify(value):
    value = value.lower()
    value = value.replace("&", "and")
    value = value.replace("'", "")
    value = value.replace("’", "")
    value = value.replace(".", "")
    value = value.replace("/", "-")
    value = re.sub(r"[^a-z0-9\- ]", "", value)
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def to_ascii(text):
    if not isinstance(text, str):
        return text
    replacements = {
        "\u00a0": " ",
        "\u2013": "-",
        "\u2014": "-",
        "\u2019": "'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_infobox_fields(soup):
    fields = {}
    for item in soup.select("aside.portable-infobox .pi-item"):
        label = item.select_one(".pi-data-label")
        value = item.select_one(".pi-data-value")
        if label and value:
            fields[label.get_text(" ", strip=True)] = value.get_text(" ", strip=True)
    return fields


def parse_section_texts(soup, heading):
    for header in soup.select(".mw-parser-output > h2"):
        title = header.get_text(" ", strip=True)
        if re.search(heading, title, re.I):
            parts = []
            for sib in header.find_next_siblings():
                if sib.name == "h2":
                    break
                if sib.name in ["p", "ul", "ol"]:
                    parts.append(sib)
            texts = []
            for el in parts:
                if el.name in ["ul", "ol"]:
                    for li in el.find_all("li"):
                        texts.append(li.get_text(" ", strip=True))
                else:
                    texts.append(el.get_text(" ", strip=True))
            return texts
    return []


def parse_description(soup, name):
    for header in soup.select(".mw-parser-output > h2"):
        title = header.get_text(" ", strip=True)
        if re.search(r"(Usage|Description)", title, re.I):
            parts = []
            for sib in header.find_next_siblings():
                if sib.name == "h2":
                    break
                if sib.name == "p":
                    text = sib.get_text(" ", strip=True)
                    if text:
                        parts.append(text)
            if parts:
                return " ".join(parts)
            p = header.find_next_sibling("p")
            return p.get_text(" ", strip=True) if p else None
    mw = soup.select_one(".mw-parser-output")
    if not mw:
        return None
    for child in mw.find_all(["p", "h2"], recursive=False):
        if child.name == "h2":
            break
        if child.name != "p":
            continue
        text = child.get_text(" ", strip=True)
        if not text:
            continue
        if "Manufacturers" in text or "Type:" in text or "Rarity:" in text:
            m = re.search(rf"{re.escape(name)}[^.]*\\.(.*)", text)
            if m and m.group(0):
                return m.group(0).strip()
            continue
        return text
    return None


def reword_sentences(lines):
    if not lines:
        return None
    sentences = []
    for line in lines:
        text = line
        text = text.replace("there are no", "you won't find")
        text = text.replace("There are no", "You won't find")
        text = text.replace("is a title", "is a nameplate")
        text = text.replace("is a title bestowed", "is a nameplate given")
        text = text.replace("has no effect", "does not change stats")
        text = text.replace("eligible for", "can roll")
        text = text.replace("instead", "in its place")
        text = text.replace("always", "only")
        text = text.replace("never", "not")
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            sentences.append(text)
    return "\n".join(sentences) if sentences else None


def summarize_description(name, wtype, desc_text):
    if not desc_text:
        return None
    base = f"{name} is a {wtype} that" if wtype else f"{name} is a weapon that"
    t = desc_text.lower()
    traits = []
    if "melee" in t:
        traits.append("leans into melee bonuses")
    if "accuracy" in t:
        traits.append("has notable accuracy")
    if "damage" in t:
        traits.append("prioritizes damage")
    if "fire rate" in t:
        traits.append("leans on fire rate")
    if "accessory" in t:
        traits.append("is defined by its accessory")
    if "burst" in t:
        traits.append("fires in bursts")
    if "explosion" in t or "explode" in t:
        traits.append("creates explosive hits")

    if traits:
        return base + " " + ", ".join(traits[:3]) + "."
    return base + " focuses on its defining parts and stat rolls."


def rewrite_text(text, name=None):
    if not text:
        return None
    text = to_ascii(text)
    replacements = [
        ("do not require any particular usage", "do not demand a specific playstyle"),
        ("have no special characteristics apart from", "lack special traits beyond"),
        ("boast a degree of accuracy", "offer accuracy"),
        ("as well as", "and"),
        ("in addition", "also"),
        ("will always", "typically"),
        ("will", "can"),
        ("increase", "boost"),
        ("decrease", "reduce"),
        ("higher", "greater"),
        ("lower", "reduced"),
        ("effect", "trait"),
        ("title", "nameplate"),
        ("bestowed", "granted"),
        ("because", "since"),
    ]
    for old, new in replacements:
        text = re.sub(rf"\\b{re.escape(old)}\\b", new, text, flags=re.I)

    sentences = re.split(r"(?<=[.!?])\\s+", text)
    cleaned = []
    for idx, sentence in enumerate(sentences):
        s = sentence.strip()
        if not s:
            continue
        if idx == 0 and name and s.lower().startswith(name.lower()):
            s = s.replace(name, f"The {name}", 1)
        cleaned.append(s)
    return " ".join(cleaned)


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


def parse_elements(fields):
    element = fields.get("Element:")
    if not element or element.lower() == "none":
        return None
    if "any" in element.lower():
        return ["Incendiary", "Shock", "Corrosive", "Explosive"]
    values = []
    for e in ["Incendiary", "Shock", "Corrosive", "Explosive"]:
        if e.lower() in element.lower():
            values.append(e)
    return values or None


def parse_multiplier(element_text):
    if not element_text:
        return None
    nums = [float(n) for n in re.findall(r"×\s*(\d+(?:\.\d+)?)", element_text)]
    if not nums:
        return None
    if len(nums) == 1:
        return [nums[0]]
    return [nums[0], nums[-1]]


def parse_manufacturer(fields, page_text):
    value = fields.get("Manufacturer :") or fields.get("Manufacturer:") or fields.get("Manufacturers :") or fields.get("Manufacturers:")
    if not value:
        return None
    if "all manufacturers" in value.lower() and "except" in value.lower():
        for m in MANUFACTURERS:
            if m.lower() in value.lower():
                return [x for x in MANUFACTURERS if x != m]
        return MANUFACTURERS
    if "all manufacturers" in value.lower():
        return MANUFACTURERS
    if value.strip().lower() == "common":
        for m in MANUFACTURERS:
            if re.search(rf"no {re.escape(m)}", page_text, re.I) or re.search(rf"except {re.escape(m)}", page_text, re.I):
                return [x for x in MANUFACTURERS if x != m]
        return None
    parts = [p.strip() for p in re.split(r",|/|and", value) if p.strip()]
    known = [m for m in MANUFACTURERS if any(m.lower() == p.lower() for p in parts)]
    return known or None


def get_card_image(soup):
    img = soup.select_one("img.pi-image-thumbnail")
    if not img:
        return None
    srcset = img.get("srcset")
    if not srcset:
        return img.get("src")
    parts = [p.strip() for p in srcset.split(",") if p.strip()]
    if not parts:
        return img.get("src")
    last = parts[-1]
    return last.split(" ")[0]


def download_image(url, slug):
    if not url:
        return None
    ext = os.path.splitext(urlparse(url).path)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg"]:
        ext = ".png"
    filename = f"{slug}{ext}"
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    path = IMG_DIR / filename
    resp = session.get(url, timeout=30)
    path.write_bytes(resp.content)
    return path


def dominant_color(path):
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
    tiers = ["Common", "Uncommon"]
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

    if 20 <= hue < 55:
        tiers += ["Rare", "Epic", "Legendary"]
    elif 170 <= hue < 190:
        tiers += ["Rare", "Epic", "Legendary", "Pearlescent"]
    elif 190 <= hue < 250:
        tiers += ["Rare"]
    elif 250 <= hue < 320:
        tiers += ["Rare", "Epic"]

    seen = []
    for v in tiers:
        if v not in seen:
            seen.append(v)
    return seen


def resolve_titles(requested, category_titles):
    by_norm = {normalize_name(t): t for t in category_titles}
    by_stripped = {normalize_name(strip_parenthetical(t)): t for t in category_titles}
    resolved = []
    missing = []
    for name in requested:
        n = normalize_name(name)
        if n in by_norm:
            resolved.append(by_norm[n])
            continue
        if n in by_stripped:
            resolved.append(by_stripped[n])
            continue
        # fallback: partial match
        candidates = [t for t in category_titles if n in normalize_name(t)]
        if len(candidates) == 1:
            resolved.append(candidates[0])
        else:
            missing.append(name)
    return resolved, missing


def main():
    if len(sys.argv) < 2:
        print("Provide one or more weapon names.")
        sys.exit(1)

    html = fetch(CATEGORY_URL)
    soup = BeautifulSoup(html, "html.parser")
    links = [a.get("href") for a in soup.select("a.category-page__member-link") if a.get("href")]
    titles = [a.get_text(strip=True) for a in soup.select("a.category-page__member-link") if a.get_text(strip=True)]
    url_map = {title: urljoin(CATEGORY_URL, link) for title, link in zip(titles, links)}

    requested = sys.argv[1:]
    resolved, missing = resolve_titles(requested, titles)

    if missing:
        print("Could not resolve:")
        for name in missing:
            print(f"- {name}")

    for title in resolved:
        url = url_map.get(title)
        if not url:
            continue

        page = fetch(url)
        psoup = BeautifulSoup(page, "html.parser")
        title_el = psoup.select_one("h1.page-header__title")
        name = title_el.get_text(strip=True) if title_el else title
        base_name = strip_parenthetical(name)
        slug = slugify(base_name)

        json_path = DATA_DIR / f"{slug}.json"
        if json_path.exists():
            print(f"exists: {json_path.name}")
            continue

        fields = parse_infobox_fields(psoup)
        wtype_raw = fields.get("Type:") or ""
        wtype = WEAPON_TYPES.get(wtype_raw)
        if not wtype:
            print(f"skip (unknown type): {name}")
            continue

        desc_raw = parse_description(psoup, name)
        description = rewrite_text(desc_raw, name=name) if desc_raw else None
        if not description:
            description = summarize_description(name, wtype_raw.lower(), desc_raw)

        notes = []
        notes += parse_section_texts(psoup, r"Notes")
        notes += parse_section_texts(psoup, r"Mechanics")
        notes_text = reword_sentences(notes)
        if notes_text:
            rewritten = []
            for line in notes_text.split("\\n"):
                rewritten_line = rewrite_text(line, name=name)
                if rewritten_line:
                    rewritten.append(rewritten_line)
            notes_text = "\\n".join(rewritten) if rewritten else notes_text

        page_text = psoup.get_text(" ", strip=True)
        manufacturer = parse_manufacturer(fields, page_text)

        # ranges
        ranges = {}
        for label, key in [
            ("Damage:", "damage"),
            ("Accuracy :", "accuracy"),
            ("Fire Rate :", "rate"),
            ("Magazine Capacity:", "mag"),
        ]:
            if label in fields:
                parsed = parse_range(fields[label])
                if parsed:
                    ranges[key] = parsed
        if not ranges:
            ranges = None

        elements = parse_elements(fields)
        multiplier = parse_multiplier(fields.get("Element:"))

        image_url = get_card_image(psoup)
        image_path = download_image(image_url, slug) if image_url else None

        rarity = rarity_from_color(dominant_color(image_path)) if image_path else ["Common", "Uncommon"]

        if description:
            description = to_ascii(description)
        if notes_text:
            notes_text = to_ascii(notes_text)

        data = OrderedDict()
        data["images"] = {"card": f"../img/card/{image_path.name}"} if image_path else None
        data["resources"] = {"wiki": url}
        data["name"] = base_name
        data["type"] = wtype
        if description:
            data["description"] = description
        if notes_text:
            data["notes"] = notes_text
        if manufacturer:
            data["manufacturer"] = manufacturer
        if elements:
            data["elements"] = elements
        if multiplier:
            data["multiplier"] = multiplier
        if rarity:
            data["rarity"] = rarity
        if ranges:
            data["ranges"] = ranges

        ordered = OrderedDict()
        for key in ORDER:
            if key in data and data[key] is not None:
                ordered[key] = data[key]

        json_path.write_text(json.dumps(ordered, indent=2) + "\n")
        print(f"wrote: {json_path.name}")


if __name__ == "__main__":
    main()
