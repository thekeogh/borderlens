#!/usr/bin/env python3
"""Scan weapon JSON files for non-ASCII artifacts and report locations."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data/borderlands/weapons/json"

found = False
for path in sorted(DATA_DIR.glob("*.json")):
    text = path.read_text()
    for i, ch in enumerate(text):
        if ord(ch) > 127:
            print(f"{path.name}: non-ASCII at index {i}: {repr(ch)}")
            found = True
            break

if not found:
    print("no non-ASCII artifacts found")
