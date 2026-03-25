#!/usr/bin/env python3
import difflib
import json
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageEnhance, ImageOps

USER_AGENT = {"user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)"}

DATA_ROOT = Path("data/games/borderlands2")
CATEGORIES = ["weapons", "shields", "grenade-mods", "class-mods", "relics"]

ASSET_ROOT = Path(".agent/bl2/item-cards")
RAW_DIR = ASSET_ROOT / "raw"
PNG_DIR = ASSET_ROOT / "png"
OCR_DIR = ASSET_ROOT / "ocr"
REPORT_PATH = ASSET_ROOT / "max-abilities-report.json"

MANUFACTURERS = {
    "ANSHIN",
    "ATLAS",
    "BANDIT",
    "DAHL",
    "ERIDIAN",
    "GEARBOX",
    "HYPERION",
    "JAKOBS",
    "MALIWAN",
    "PANGOLIN",
    "S&S MUNITIONS",
    "TEDIORE",
    "TORGUE",
    "VLADOF",
    "SCAV",
}


def ensure_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    OCR_DIR.mkdir(parents=True, exist_ok=True)


def fetch_text(url: str) -> str:
    response = requests.get(url, headers=USER_AGENT, timeout=30)
    response.raise_for_status()
    return response.text


def fetch_bytes(url: str) -> bytes:
    response = requests.get(url, headers=USER_AGENT, timeout=60)
    response.raise_for_status()
    return response.content


def parse_item_card_url(lootlemon_url: str) -> Optional[str]:
    html = fetch_text(lootlemon_url)
    soup = BeautifulSoup(html, "html.parser")
    image = soup.select_one("img#item-card")
    if not image:
        return None
    src = (image.get("src") or "").strip()
    if src.startswith("/"):
        return f"https://www.lootlemon.com{src}"
    return src or None


def run_tesseract(path: Path) -> str:
    return subprocess.run(
        ["tesseract", str(path), "stdout", "--psm", "6"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def ocr_image(card_url: str, slug: str) -> Tuple[Dict[str, str], Path]:
    ext = Path(card_url.split("?")[0]).suffix.lower() or ".img"
    raw_path = RAW_DIR / f"{slug}{ext}"
    png_path = PNG_DIR / f"{slug}.png"

    raw_path.write_bytes(fetch_bytes(card_url))

    subprocess.run(
        ["sips", "-s", "format", "png", str(raw_path), "--out", str(png_path)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["sips", "-Z", "1800", str(png_path), "--out", str(png_path)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    image = Image.open(png_path).convert("RGB")
    gray = ImageOps.grayscale(image)
    gray = ImageEnhance.Contrast(gray).enhance(2.2)

    gray_path = PNG_DIR / f"{slug}-gray.png"
    bw160_path = PNG_DIR / f"{slug}-bw160.png"
    bw180_path = PNG_DIR / f"{slug}-bw180.png"

    gray.save(gray_path)
    gray.point(lambda p: 255 if p > 160 else 0).save(bw160_path)
    gray.point(lambda p: 255 if p > 180 else 0).save(bw180_path)

    ocr_gray = run_tesseract(gray_path)
    ocr_bw160 = run_tesseract(bw160_path)
    ocr_bw180 = run_tesseract(bw180_path)

    ocr_path = OCR_DIR / f"{slug}.txt"
    ocr_path.write_text(
        "\n\n=== gray ===\n"
        + ocr_gray
        + "\n\n=== bw160 ===\n"
        + ocr_bw160
        + "\n\n=== bw180 ===\n"
        + ocr_bw180,
        encoding="utf-8",
    )

    return {"gray": ocr_gray, "bw160": ocr_bw160, "bw180": ocr_bw180}, png_path


def clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalise_compare(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def strip_bullet_prefix(line: str) -> str:
    return re.sub(r"^[\s\-\*\u2022:;,.|]+", "", line).strip()


def parse_float(raw: str) -> Optional[float]:
    candidate = raw.strip().replace(",", "")
    candidate = candidate.replace("O", "0").replace("o", "0")
    candidate = re.sub(r"[^0-9.\-+]", "", candidate)
    if not candidate:
        return None
    try:
        return float(candidate)
    except ValueError:
        return None


def parse_percent(line: str, key_phrase: str) -> Optional[float]:
    pattern = rf"{re.escape(key_phrase)}[^0-9+\-]*([+\-]?\d[\d,]*(?:\.\d+)?)"
    match = re.search(pattern, line, flags=re.IGNORECASE)
    if not match:
        return None
    return parse_float(match.group(1))


def parse_stats(lines: List[str]) -> Dict[str, float]:
    stats: Dict[str, float] = {}

    for raw_line in lines:
        line = clean_space(raw_line)
        if not line:
            continue

        line = line.replace("xi", "x1").replace("xI", "x1")
        line = line.replace(" /sec", " / sec")
        line = line.replace(" /SEC", " / sec")
        line = strip_bullet_prefix(line)
        lower = line.lower()

        if re.search(r"overpower\s*requirement", lower):
            match = re.search(r"overpower\s*requirement[^0-9+\-]*([+\-]?\d[\d,]*(?:\.\d+)?)", lower)
            value = parse_float(match.group(1)) if match else None
            if value is not None:
                stats["level"] = 80.0 + value if 0 < value <= 10 else value
            continue

        if re.search(r"level\s*requirement", lower):
            match = re.search(r"level\s*requirement[^0-9+\-]*([+\-]?\d[\d,]*(?:\.\d+)?)", lower)
            value = parse_float(match.group(1)) if match else None
            if value is not None:
                stats["level"] = 80.0 + value if 0 < value <= 10 else value
            continue

        def pick(key: str, value: Optional[float]) -> None:
            if value is None:
                return
            stats[key] = value

        if "capacity" in lower:
            pick("capacity", parse_percent(lower, "capacity"))
            continue
        if "recharge rate" in lower:
            pick("recharge_rate", parse_percent(lower, "recharge rate"))
            continue
        if "recharge delay" in lower:
            pick("recharge_delay", parse_percent(lower, "recharge delay"))
            continue
        if "absorb chance" in lower:
            pick("absorb_chance", parse_percent(lower, "absorb chance"))
            continue
        if "blast radius" in lower:
            pick("blast_radius", parse_percent(lower, "blast radius"))
            continue
        if "fuse time" in lower:
            pick("fuse_time", parse_percent(lower, "fuse time"))
            continue
        if "reload speed" in lower:
            pick("reload", parse_percent(lower, "reload speed"))
            continue
        if "fire rate" in lower:
            pick("rate", parse_percent(lower, "fire rate"))
            continue
        if "magazine size" in lower:
            pick("mag", parse_percent(lower, "magazine size"))
            continue
        if "accuracy" in lower and "weapon accuracy" not in lower:
            pick("accuracy", parse_percent(lower, "accuracy"))
            continue
        if "gun damage" in lower:
            pick("gun_damage_bonus", parse_percent(lower, "gun damage"))
            continue
        if "weapon accuracy" in lower:
            pick("weapon_accuracy_bonus", parse_percent(lower, "weapon accuracy"))
            continue
        if "cooldown rate" in lower:
            pick("cooldown_rate_bonus", parse_percent(lower, "cooldown rate"))
            continue
        if "grenade damage" in lower:
            match = re.search(r"grenade damage\s*([+\-]?\d[\d,]*(?:\.\d+)?)(?:\s*x\s*(\d+))?", lower)
            if match:
                pick("grenade_damage", parse_float(match.group(1)))
                if match.group(2):
                    pick("grenade_damage_multiplier", parse_float(match.group(2)))
            continue

        if "damage" in lower and "grenade damage" not in lower and "damage / sec" not in lower and "damage/sec" not in lower:
            if re.search(r"\b(fire|shock|corrosive|corrode|slag|electro|explosive)\s+damage\b", lower):
                continue
            if re.search(r"\bdamage\s*[+\-]", lower):
                continue
            match = re.search(r"\bdamage\s*([+\-]?\d[\d,]*(?:\.\d+)?)", lower)
            if match:
                pick("damage", parse_float(match.group(1)))
            continue

    return stats


def line_is_currency(line: str) -> bool:
    compact = line.strip().replace(" ", "")
    return bool(re.match(r"^\$?[0-9,()'`]+$", compact))


def looks_like_manufacturer(line: str) -> bool:
    upper = clean_space(strip_bullet_prefix(line)).upper()
    if not upper:
        return False
    if upper in MANUFACTURERS:
        return True
    for manufacturer in MANUFACTURERS:
        if re.search(rf"\b{re.escape(manufacturer)}\b", upper):
            return True
    return False


def similar_to_red_text(line: str, red_text: str) -> bool:
    left = normalise_compare(line)
    right = normalise_compare(red_text)
    if not left or not right:
        return False
    if left in right or right in left:
        return True
    return difflib.SequenceMatcher(a=left, b=right).ratio() >= 0.72


def is_bullet_line(line: str) -> bool:
    return line.lstrip().startswith("-")


def looks_like_stat_or_header(line: str) -> bool:
    text = clean_space(strip_bullet_prefix(line))
    lower = text.lower()
    if not text:
        return True
    if looks_like_manufacturer(text):
        return True
    if line_is_currency(text):
        return True
    if "overpower requirement" in lower or "level requirement" in lower or "class requirement" in lower:
        return True
    if re.search(r"\d", lower):
        stat_tokens = [
            "damage",
            "accuracy",
            "fire rate",
            "reload",
            "magazine",
            "capacity",
            "recharge",
            "absorb chance",
            "blast radius",
            "fuse time",
            "cooldown rate",
            "gun damage",
            "weapon accuracy",
        ]
        if any(token in lower for token in stat_tokens):
            return True
    return False


def is_probably_noise(line: str) -> bool:
    text = clean_space(line)
    if not text:
        return True
    letters = len(re.findall(r"[A-Za-z]", text))
    if letters < 4:
        return True
    ratio = letters / max(len(text), 1)
    if ratio < 0.45 and re.search(r"[^A-Za-z0-9 .,:%+'/-]", text):
        return True
    return False


def collect_bullet_lines(lines: List[str]) -> List[str]:
    out: List[str] = []
    i = 0
    while i < len(lines):
        line = clean_space(lines[i])
        if not is_bullet_line(line):
            i += 1
            continue

        current = strip_bullet_prefix(line)
        j = i + 1
        while j < len(lines):
            nxt = clean_space(lines[j])
            if not nxt:
                j += 1
                continue
            if is_bullet_line(nxt):
                break
            if looks_like_stat_or_header(nxt):
                break
            if is_probably_noise(nxt):
                break
            current = f"{current} {strip_bullet_prefix(nxt)}".strip()
            j += 1

        out.append(clean_space(current))
        i = j
    return out


def extract_abilities(lines: List[str], red_text: str) -> List[str]:
    out: List[str] = []
    for raw in collect_bullet_lines(lines):
        ability = clean_space(raw)
        if not ability:
            continue
        if len(re.findall(r"[A-Za-z]", ability)) < 4:
            continue

        if line_is_currency(ability):
            continue
        if looks_like_manufacturer(ability):
            continue
        if similar_to_red_text(ability, red_text):
            continue

        if re.search(r"grants immunity to .+ damage", ability, flags=re.IGNORECASE):
            ability = "Grants immunity to elemental damage."

        if re.search(r"^highly .+ flesh", ability, flags=re.IGNORECASE):
            ability = "Highly effective vs Flesh."

        if re.search(r"(damage\s*/\s*sec|ignite chance|electrocute chance|corrode chance|slag chance)", ability, flags=re.IGNORECASE):
            continue

        if re.search(r"chance to absorb .*bullets", ability, flags=re.IGNORECASE):
            ability = "Chance to Absorb enemy bullets."
        if re.search(r"absorbed ammo .*backpack", ability, flags=re.IGNORECASE):
            ability = "Absorbed ammo is added to your backpack."

        if "skill" in ability.lower():
            ability = re.sub(r"^(.*?\bSkill)\b.*$", r"\1", ability, flags=re.IGNORECASE)
        elif "." in ability:
            first, rest = ability.split(".", 1)
            if len(first) >= 12 and is_probably_noise(rest):
                ability = f"{first}."

        ability = ability.replace("|", " ")

        # Remove trailing manufacturer-like bleed.
        upper = ability.upper()
        for manufacturer in MANUFACTURERS:
            match = re.search(rf"\b{re.escape(manufacturer)}\b", upper)
            if match:
                ability = ability[: match.start()].strip()
                break

        # Remove embedded red-text tails if OCR fused them into bullet text.
        red_words = [word for word in re.findall(r"[A-Za-z]{4,}", red_text.lower())]
        for word in red_words:
            index = ability.lower().find(word)
            if index > 12:
                ability = ability[:index].strip()
                break

        ability = re.sub(r"[`'()]{3,}.*$", "", ability).strip()
        ability = re.sub(r"\s{2,}", " ", ability)
        ability = re.sub(r"\bef\s+fective\b", "effective", ability, flags=re.IGNORECASE)
        if ability.lower().startswith("highly"):
            ability = re.sub(r"\bus\b", "vs", ability, flags=re.IGNORECASE)

        if re.search(r"[^A-Za-z0-9 .,:%+'/-]", ability):
            continue
        if similar_to_red_text(ability, red_text):
            continue

        if not ability:
            continue
        if ability not in out:
            out.append(ability)

    return out


def to_schema_number(value: float) -> float:
    if abs(value - round(value)) < 1e-9:
        return int(round(value))
    return round(value, 4)


def merge_stat_candidates(candidates: List[Dict[str, float]]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    keys = sorted({key for candidate in candidates for key in candidate.keys()})

    for key in keys:
        values = [candidate[key] for candidate in candidates if key in candidate]
        if not values:
            continue

        rounded = [round(value, 4) for value in values]
        freq: Dict[float, int] = {}
        for value in rounded:
            freq[value] = freq.get(value, 0) + 1

        best_count = max(freq.values())
        winners = [value for value, count in freq.items() if count == best_count]
        if len(winners) == 1:
            out[key] = winners[0]
            continue

        sorted_values = sorted(values)
        middle = len(sorted_values) // 2
        if len(sorted_values) % 2 == 1:
            out[key] = sorted_values[middle]
        else:
            out[key] = (sorted_values[middle - 1] + sorted_values[middle]) / 2

    return out


def postprocess_stats(stats: Dict[str, float]) -> Dict[str, float]:
    out = dict(stats)
    reload = out.get("reload")
    if isinstance(reload, (int, float)) and reload > 10:
        while reload > 10:
            reload = reload / 10
        out["reload"] = reload
    return out


def sanitise_stats(stats: Dict[str, float]) -> Dict[str, float]:
    out: Dict[str, float] = {}

    min_one = {"level", "damage", "grenade_damage_multiplier"}
    min_zero = {
        "accuracy",
        "rate",
        "reload",
        "mag",
        "capacity",
        "recharge_rate",
        "recharge_delay",
        "absorb_chance",
        "grenade_damage",
        "blast_radius",
        "fuse_time",
    }
    percent_like = {"accuracy", "absorb_chance"}

    for key, value in stats.items():
        if not isinstance(value, (int, float)):
            continue

        v = float(value)

        # OCR often loses decimal points in percent-like values (e.g. 931 -> 93.1).
        if key in percent_like and v > 100:
            while v > 100 and v < 10000:
                v = v / 10

        if key == "level":
            # BL2 OP cards represent OP tiers; persist effective level (80 + OP).
            if 0 < v <= 10:
                v = 80 + v
            # OCR occasionally reads OP10 as 100; normalise to the BL2 cap.
            elif 90 < v <= 100:
                v = 90

        if key in min_one and v < 1:
            continue
        if key in min_zero and v < 0:
            continue
        if key == "absorb_chance" and v > 100:
            continue

        out[key] = v

    return out


def main() -> None:
    ensure_dirs()

    scanned = 0
    with_lootlemon = 0
    changed = 0
    failures: List[Dict[str, str]] = []

    max_written = 0
    abilities_written = 0

    for category in CATEGORIES:
        for path in sorted((DATA_ROOT / category).glob("*.json")):
            scanned += 1
            item = json.loads(path.read_text(encoding="utf-8"))
            lootlemon_url = ((item.get("resources") or {}).get("lootlemon") or "").strip()
            if not lootlemon_url:
                continue
            with_lootlemon += 1

            slug = item.get("slug") or path.stem
            red_text = ((item.get("special") or {}).get("title") or "").strip()
            try:
                card_url = parse_item_card_url(lootlemon_url)
                if not card_url:
                    continue

                ocr_variants, _ = ocr_image(card_url, slug)
                lines_gray = [line.strip() for line in ocr_variants["gray"].splitlines() if line.strip()]
                lines_bw160 = [line.strip() for line in ocr_variants["bw160"].splitlines() if line.strip()]
                lines_bw180 = [line.strip() for line in ocr_variants["bw180"].splitlines() if line.strip()]

                parsed_stats = sanitise_stats(postprocess_stats(merge_stat_candidates([
                    parse_stats(lines_gray),
                    parse_stats(lines_bw160),
                    parse_stats(lines_bw180),
                ])))
                parsed_abilities = extract_abilities(lines_gray, red_text)

                schema_stats: Dict[str, float] = {}
                for key, value in parsed_stats.items():
                    schema_stats[key] = to_schema_number(value)

                before = json.dumps(item, sort_keys=True)

                if schema_stats:
                    item["max"] = schema_stats
                    max_written += 1
                elif "max" in item:
                    del item["max"]

                if parsed_abilities:
                    item["abilities"] = parsed_abilities
                    abilities_written += 1
                elif "abilities" in item:
                    del item["abilities"]

                after = json.dumps(item, sort_keys=True)
                if before != after:
                    changed += 1
                    path.write_text(f"{json.dumps(item, indent=2, ensure_ascii=True)}\n", encoding="utf-8")

            except Exception as error:
                failures.append({
                    "file": str(path),
                    "slug": str(slug),
                    "error": str(error),
                })

    report = {
        "scanned": scanned,
        "with_lootlemon": with_lootlemon,
        "changed": changed,
        "max_written": max_written,
        "abilities_written": abilities_written,
        "failed": len(failures),
        "failures": failures[:100],
    }
    REPORT_PATH.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
