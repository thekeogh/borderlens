# Session Notes — Weapon Description Fixes

## Goal
Scan all weapon JSON files in `data/borderlands/weapons/json` and correct any inaccurate `description` and `special.description` values by using **both** the wiki and Lootlemon pages when available.

## Critical rules (from user)
- **Always use AI rewording** (manual rewriting) for `description` and `special.description`.
- **Do not** script a mechanical rewording. Read the source text, merge it, and rewrite it in fluent, original English.
- **Do not change facts**; preserve all context and factual details.
- **Use both sources when present**:
  - `resources.wiki`
  - `resources.lootlemon` (if present)
- **If Lootlemon is missing**, use the wiki only.
- **No image work** for this task.
- **No new files beyond .codex updates**; focus on fixing existing JSONs.
- Update `.codex` assets/notes whenever workflows or rules change.

## Source extraction rules
- **special.description**: combine the “red text ability” details from **both** sources.
  - Wiki: usually under “Special Weapon Effects” or similar text near red flavor.
  - Lootlemon: use “Unique Ability” or relevant ability description.
  - Merge both verbatim sources into a single draft, then rewrite in your own words.
- **description**: combine the main weapon description from **both** sources.
  - Wiki sections vary: “Usage”, “Usage & Description”, “Description”, “Description & Usage”, etc.
  - Lootlemon: “About” section.
  - Merge both verbatim sources into a single draft, then rewrite in your own words.

## Workflow to apply across all weapons
1. Open each weapon JSON and read `resources.wiki` and `resources.lootlemon` if present.
2. Scrape the relevant wiki section (Usage/Description variants) and Lootlemon “About.”
3. Scrape the red text ability from wiki and Lootlemon “Unique Ability.”
4. Merge each pair into a combined draft.
5. Rewrite **manually** in fluent English, keeping all facts intact.
6. Update `description` and `special.description` in the JSON.
7. Leave all other fields unchanged.

## Example already fixed
- `data/borderlands/weapons/json/lady-finger.json`
  - Corrected `special.description` based on both sources.
  - Rewrote `description` to include full context (critical bonus, early-game, Nine-Toes).

## Notes about existing tooling
- `.codex/scrape_weapons.py` is dual-source, but it **skips** wiki-only entries (requires both URLs).
- `.codex/scrape_common_from_category.py` and `.codex/scrape_wiki_weapons_by_title.py` are wiki-only creators.
- `.codex/README.md` has been updated to reflect the merge-then-rewrite rule.

## Next step requested by user
- Scan **all** weapons and adjust inaccurate descriptions using the above rules.
- No need to ask permission for file edits in this repo.
