# Codex Scraping Helpers

Scripts saved from this session for resuming work.

- `scrape_weapons.py` – Main scraper that populates weapon JSON files using Lootlemon + wiki.
- `clean_text.py` – Post-process descriptions/special descriptions for grammar cleanup.
- `scan_artifacts.py` – Scan JSON files for non-ASCII artifacts.
- `scrape_common_from_category.py` – Wiki-only scraper for missing/common weapons + card image download.
- `update_rarity_from_cards.py` – Recompute rarity tiers from card title color.
- `scrape_wiki_weapons_by_title.py` – Scrape specific wiki weapons by title from the category list.
- `SESSION_NOTES.md` – Running instructions and rules for the all-weapons description fix pass.

Paths

- JSON: `data/borderlands/weapons/json`
- Card images: `data/borderlands/weapons/img/card`

Usage:

```bash
python3 .codex/scrape_weapons.py
python3 .codex/clean_text.py
python3 .codex/scan_artifacts.py
python3 .codex/scrape_common_from_category.py
python3 .codex/update_rarity_from_cards.py
python3 .codex/scrape_wiki_weapons_by_title.py \"Brute\" \"Carnage\" \"Death\"
```

Notes

- Wiki descriptions and notes are scraped as raw text, then manually reworded by the assistant in a follow-up pass (no verbatim copy).
- JSON and image filenames use the plain weapon name (parentheticals like "(Borderlands)" or "(Title)" are removed).
- When correcting existing weapon text, combine Lootlemon (About/Unique Ability) and wiki (Usage/Description or similar heading) content, then rewrite the merged text in fluent original English without changing any facts.
