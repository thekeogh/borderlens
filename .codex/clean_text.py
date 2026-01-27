#!/usr/bin/env python3
"""Post-process weapon JSON text fields for grammar and artifact cleanup."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/borderlands/weapons/json"

REPLACEMENTS = [
    ("Eridian Eridian", "Eridian weapon"),
    ("It shots", "Its shots"),
    ("and dumping", "and dumps"),
    ("but lowers slow ", "but has slow "),
    ("but lowers slower ", "but has a slower "),
    ("but lowers lower ", "but has lower "),
    ("but lowers wider ", "but has wider "),
    ("but lowers heavier ", "but has heavier "),
    ("but lowers smaller ", "but has smaller "),
    ("but lowers faster ", "but has faster "),
]


def fix(text):
    if not isinstance(text, str):
        return text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


for path in DATA_DIR.glob("*.json"):
    data = json.loads(path.read_text())
    if "description" in data:
        data["description"] = fix(data["description"])
    if "special" in data and isinstance(data["special"], dict):
        if "description" in data["special"]:
            data["special"]["description"] = fix(data["special"]["description"])
    path.write_text(json.dumps(data, indent=2) + "\n")

print("cleaned")
