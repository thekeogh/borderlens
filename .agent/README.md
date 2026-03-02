# Codex Data Workflow README

This file is the operating guide for scraping, normalising, and validating game item data in this repo.
It should be enough for a new agent to complete a full category (for example weapons, shields, relics) end-to-end.

## Scope And Intent

- Work only in this repository and store helper assets/scripts in `.agent/`.
- Use `.agent/temp/` for disposable files only.
- Keep this README updated whenever rules/process change.

## Non-Negotiable Rules

1. One shared schema only:
   - `src/database/schema/index.ts`
   - Never create a per-game schema.
2. Schema evolution rules:
   - Reuse existing enums.
   - Add new enum values globally when needed.
   - New fields must be optional if BL1 does not use them.
3. Folder naming:
   - No dashes in game folder names (use `borderlands2`, not `borderlands-2`).
4. Image contract:
   - JSON `image` path uses `/img/games/<game>/<category>/<slug>.png`.
   - Real image files are stored in `data/games/<game>/<category>/img/<slug>.png`.
   - Do not write files into `public/`.
5. Source priority:
   - Prefer Lootlemon for structured values when it conflicts with wiki.
6. Canonical naming:
   - Use current/official name as primary `name` and filename/slug.
   - Put older/alternate names in `aliases`.
7. Slugs:
   - Lowercase, dash-separated, clean.
   - No underscores and no repeated dashes.
8. Narrative ownership:
   - Long text fields are rewritten by AI in-session, not by word-replacement scripts.
9. Sources are required:
   - Every item JSON must contain a non-empty `sources` array.
   - If no explicit source is known, add a pool fallback with tags `["Loot Pool", "World Wide"]`.
10. Element semantics:
   - `elements` may include `"None"` to indicate non-elemental rolls are possible.
   - This is distinct from missing `elements` (unknown/not-applicable data).

## Canonical Paths

- Data root: `data/games/<game>/<category>/`
- Images: `data/games/<game>/<category>/img/`
- Schema root: `src/database/schema/`
- BL2 weapons path (reference): `data/games/borderlands2/weapons/`

## End-To-End Workflow (Use For Any New Category)

### 1) Prepare Category Workspace

1. Create category folder under `data/games/<game>/<category>/`.
2. Create image subfolder: `data/games/<game>/<category>/img/`.
3. Add/update scripts in `.agent/scripts/` as needed.

### 2) Seed Item List From Sources

1. Gather all candidate items from:
   - Lootlemon category listing.
   - Wiki category listing/API.
2. Create one JSON file per candidate item.
3. Fill known required fields immediately (`name`, `slug`, `game`, `category`, etc.).
4. If item classification is uncertain at seed stage, still create the JSON file.

### 3) Cleanup And Canonical Merge

1. Remove obvious non-category/meta entries when confidence is high.
2. Merge duplicate entries across Lootlemon/wiki into one canonical file.
3. Preserve alternates in `aliases`.
4. Prefer current official naming for filename and `name`.

### 4) Schema Updates (If Needed)

1. Extend shared enums or shared optional fields.
2. Keep backward compatibility with BL1:
   - mark new fields optional when BL1 does not use them.
3. Run validation after schema changes.

### 5) Structured Enrichment Pass

Populate as much structured data as possible from sources:

- `type`
- `manufacturer(s)`
- `content`
- `rarities`
- `elements`
- `parts`
- `sources` (drop source, mission, world drop, etc.)

If an item still has no explicit source after enrichment, add a fallback pool source:

- weapons: type pool (for example `AR Pool`, `SMG Pool`, `Shotgun Pool`)
- grenade mods: `Grenade Pool`
- shields: `Shield Pool`
- relics: `Relic Pool`
- class mods: class pool (for example `Axton Pool`, `Maya Pool`, `Zer0 Pool`)

Element extraction rule for BL2 weapons/shields/grenade mods:

- Prefer Lootlemon item-page element icons (`img.icon-round`) as primary evidence.
- Map `Non-Elemental` to schema element `"None"`.
- If Lootlemon evidence is unavailable, use wiki infobox `element*` fields as fallback.
- Wiki `Any` implies all variants, including `"None"` and all elemental types.
- `special.title` (where applicable)

Rules:

- Lootlemon first for structured values.
- Wiki used to fill gaps and cross-check.
- Keep confidence-based decisions explicit in scripts/notes.
- Rarity handling rule applies to all item categories (weapons, shields, grenade mods, and future categories):
  - If wiki `Rarity` is `Unique`, map schema rarity from wiki `Color`.
  - If wiki `Rarity` is `Common`, use the item card name colour from the downloaded image as the effective top tier, then set cumulative rarities from `Common` up to that tier.
  - If an item is Legendary or above as a fixed tier, keep it as a single rarity.

### 6) Image Pass

1. Resolve wiki infobox image.
2. Parse `srcset` and always choose the largest candidate (`3x > 2x > 1x`, or widest fallback).
3. Download and convert to PNG.
4. Save to `data/games/<game>/<category>/img/<slug>.png`.
5. Keep JSON image path in `/img/games/<game>/<category>/<slug>.png`.
6. Lootlemon page-image capture (new):
   - For items with `resources.lootlemon`, fetch `img#page-image` from that page.
   - Save to `data/games/<game>/<category>/img/lootlemon/<slug>.png`.
   - If source format is AVIF/WEBP/JPG, convert to PNG and remove the temporary original file.

### 7) Lootlemon Item-Card Pass (`max` + `abilities`)

Use this pass for Lootlemon-backed items (all categories), based on item-page `img#item-card`.

1. Scope:
   - Use only items with `resources.lootlemon`.
   - Skip wiki-only items (no Lootlemon card available).
2. Extract numeric card stats into `max`.
   - For BL2 OP cards, store effective level in `max.level`:
     - OP10 -> `90`
     - OP8 -> `88`
   - Do not store OP as a string in `max.level`.
3. Extract bullet utility/mechanic lines into `abilities`.
4. Do not store these card lines:
   - red text line (already represented by `special.title`),
   - cash value,
   - manufacturer line.
5. Shield immunity normalisation:
   - Convert specific immunity wording (for example Burn/Shock/Corrode) to:
     - `Grants immunity to elemental damage.`
6. Elemental proc line rule:
   - If `elements` has exactly one value (including `"None"`), keep proc stats/lines (for example `Burn Damage / sec`, `Ignite Chance`).
   - If `elements` has multiple possible values, skip elemental proc stats/lines from `max`/`abilities`.
7. OCR hygiene/sanitisation:
   - Keep ASCII-safe output only.
   - Drop schema-invalid numeric values before writing.
   - Apply decimal recovery for OCR-missed dots in percent-like values where safe.
8. Cache size note:
   - `.agent/bl2/item-cards/{raw,png,ocr}` are disposable build caches and can be deleted any time to reduce repo size.
   - Keep `max-abilities-report.json` if you want the latest run summary.

### 8) Narrative Pass (Description/Notes/Special)

Current approved method:

- Model: **OpenAI GPT-5.2**
- Fields:
  - `description`
  - `notes`
  - `special.description`

Rules:

1. British English only.
2. Fully reword; no copy-paste phrasing.
3. Preserve important gameplay context.
4. No source mentions in player-facing text.
5. Avoid duplication/repetition.
6. Hard limit per non-empty narrative field: `<= 600` chars.
7. Paragraph breaks are allowed when useful (`\n\n`).
8. ASCII-safe output only.

Special object rule:

- If `special.description` is empty and `special.title` is also empty/missing, remove the `special` object.

### 9) Validation And Quality Gates

Run before sign-off:

1. `pnpm run database`
2. Length gate for narrative fields (`description`, `notes`, `special.description`) <= 600
3. ASCII hygiene check:
   - `rg -n --pcre2 "[^\\x00-\\x7F]" data/games/**/*.json`
4. Ensure no empty `special` objects.

## BL2 Weapons-Specific Rules Already Applied

These were used for BL2 weapons and may be reusable in similar categories:

1. Wiki `Unique` rarity handling:
   - If wiki `Rarity` is `Unique`, map schema rarity from wiki `Color`.
   - If color is missing/non-tier, use downloaded card-name colour as fallback.
2. Legendary-and-above items stay fixed as single rarity.
3. For wiki entries that claim `Common` but image clearly shows higher tier name colour, expand cumulative rarities up to that tier when evidence is strong.

## Active Script Inventory (.agent/scripts)

Core BL2 scripts in use:

- `bootstrap-bl2-weapons.ts`
  - Seed list creation from Lootlemon + wiki.
- `bootstrap-bl2-shields.py`
  - Full BL2 shield bootstrap from Lootlemon list + wiki category mapping.
- `bootstrap-bl2-grenade-mods.py`
  - BL2 grenade mod bootstrap from Lootlemon list + mixed wiki weapons category filtering.
- `bootstrap-bl2-class-mods.py`
  - BL2 class mod bootstrap from Lootlemon list + wiki class-mod category mapping.
- `bootstrap-bl2-relics.py`
  - BL2 relic bootstrap from Lootlemon list + wiki relic category mapping and gap fill.
- `cleanup-bl2-weapons.ts`
  - Non-weapon/meta cleanup and naming cleanup.
- `canonical-merge-bl2-weapons.ts`
  - Canonical merge and alias handling.
- `scrape-bl2-weapon-images.ts`
  - Wiki image extraction and PNG download/write.
- `scrape-bl2-shield-images.ts`
  - Wiki shield image extraction and PNG download/write.
- `scrape-bl2-grenade-images.ts`
  - Wiki grenade mod image extraction and PNG download/write.
- `scrape-bl2-class-mod-images.ts`
  - Wiki class mod image extraction and PNG download/write.
- `scrape-bl2-relic-images.ts`
  - Wiki relic image extraction and PNG download/write.
- `scrape-bl2-lootlemon-page-images.py`
  - Downloads Lootlemon `img#page-image` for all BL2 items with `resources.lootlemon` and stores PNGs in per-category `img/lootlemon/`.
- `enrich-bl2-parts.ts`
  - Lootlemon parts extraction.
- `enrich-bl2-rarities.py`
  - Rarity heuristic pass.
- `apply-bl2-unique-color-rarity.ts`
  - Wiki `Unique` -> color-based rarity correction.
- `enrich-bl2-structured-pass.ts`
  - Structured backfill for missing fields.
- `enrich-bl2-elements-none.py`
  - BL2 element enrichment for weapons/shields/grenade mods, including `Non-Elemental` -> `"None"` mapping.
- `ingest-bl2-raw-narratives.ts`
  - Raw narrative ingest from both sources (pre-rewrite staging).
- `rewrite-bl2-narratives-openai.ts`
  - GPT-5.2 narrative rewrite pass with char cap and cleanup.
- `rewrite-bl2-shields-narratives-openai.ts`
  - GPT-5.2 narrative rewrite pass for BL2 shields (`description`, `notes`, `special.description`).
- `rewrite-bl2-grenade-mods-narratives-openai.ts`
  - GPT-5.2 narrative rewrite pass for BL2 grenade mods (`description`, `notes`, `special.description`).
- `rewrite-bl2-class-mods-narratives-openai.ts`
  - GPT-5.2 narrative rewrite pass for BL2 class mods (`description`, `notes`, `special.description`).
- `rewrite-bl2-relics-narratives-openai.ts`
  - GPT-5.2 narrative rewrite pass for BL2 relics (`description`, `notes`, `special.description`).
- `enforce-british-english.ts`
  - British English normalisation support pass.
- `enrich-bl2-max-abilities-from-lootlemon.py`
  - Lootlemon `img#item-card` OCR extraction for BL2 `max` and `abilities`, with sanitisation and schema-safe writes.

## Recommended Command Order (Template)

Use this sequence for new categories, adapting script names:

1. Seed:
   - `pnpm tsx .agent/scripts/<seed-script>.ts`
2. Cleanup/canonical merge:
   - `pnpm tsx .agent/scripts/<cleanup-script>.ts`
   - `pnpm tsx .agent/scripts/<canonical-merge-script>.ts`
3. Structured enrichment:
   - `pnpm tsx .agent/scripts/<structured-script>.ts`
4. Images:
   - `pnpm tsx .agent/scripts/<image-script>.ts`
5. Item-card enrichment (Lootlemon only):
   - `python3 .agent/scripts/enrich-bl2-max-abilities-from-lootlemon.py`
6. Raw narratives (optional staging):
   - `pnpm tsx .agent/scripts/<raw-narrative-script>.ts`
7. GPT-5.2 rewrite:
   - `pnpm tsx .agent/scripts/<rewrite-script>.ts`
8. Final validation:
   - `pnpm run database`
   - ASCII scan
   - length/special-object checks

## Current Status Snapshot (Borderlands 2 Weapons)

- Dataset path: `data/games/borderlands2/weapons/`
- Item files: `313`
- Images: complete in `data/games/borderlands2/weapons/img/`
- Narratives:
  - GPT-5.2 rewritten
  - British English
  - no field above 600 chars
- Validation:
  - `pnpm run database` passing

## New Category Quick Checklist

Use this before starting any new category:

1. Confirm target paths:
   - `data/games/<game>/<category>/`
   - `data/games/<game>/<category>/img/`
2. Confirm schema impact:
   - Reuse shared schema only.
   - Add new enum values globally.
   - Mark new fields optional if BL1 does not use them.
3. Seed from both sources:
   - Lootlemon list + wiki category/API.
   - Create one JSON per candidate item.
4. Run cleanup and canonical merge:
   - Remove obvious meta/non-category rows.
   - Resolve duplicates and keep alternates in `aliases`.
5. Populate structured fields first:
   - `type`, `manufacturers`, `content`, `rarities`, `elements`, `parts`, `sources`, `special.title`.
6. Download images:
   - Use largest `srcset` image.
   - Store as PNG in `data/games/<game>/<category>/img/`.
   - Keep JSON image URL as `/img/games/<game>/<category>/<slug>.png`.
7. Rewrite long text with GPT-5.2:
   - `description`, `notes`, `special.description`.
   - British English, no source mentions, no copy phrasing, no repetition.
   - Keep each non-empty field at `<= 600` chars.
   - Paragraph breaks allowed with `\n\n`.
8. Apply final hygiene rules:
   - Remove empty `special` object when no title and no description.
   - Ensure ASCII-safe JSON text only.
9. Validate before sign-off:
   - `pnpm run database`
   - `rg -n --pcre2 "[^\\x00-\\x7F]" data/games/**/*.json`

## BL2 Shields Pilot (First 5) - 2026-02-26

Scope completed for review (fully end-to-end):

1. `1340-shield.json`
2. `aequitas.json`
3. `antagonist.json`
4. `big-boom-blaster.json`
5. `black-hole.json`

Paths:

- JSON: `data/games/borderlands2/shields/`
- Images: `data/games/borderlands2/shields/img/`

What was completed:

1. Created shield category folder and five fully populated JSON records.
2. Added structured fields (`content`, `dlc`, `type`, `manufacturers`, `rarities`, `elements`, `sources`, `special`).
3. Re-authored long text fields in British English with concise wording and no source mentions.
4. Downloaded wiki infobox images using largest `srcset` candidate and converted to PNG.
5. Ensured schema-valid image paths (`/img/games/borderlands2/shields/<slug>.png`).

Schema update made:

- `src/database/schema/shields/type.schema.ts`
  - Added BL2 shield types:
    - `Absorb`
    - `Adaptive`
    - `Amplify`
    - `Booster`
    - `Reflect`
    - `Roid`
    - `Spike`
    - `Turtle`

Source handling notes:

1. Lootlemon listing confirmed 29 BL2 shields.
2. Wiki category includes mixed pages (total 44 members), so wiki data is used selectively.
3. Direct wiki page fetch may return Cloudflare 403; use MediaWiki parse API:
   - `https://borderlands.fandom.com/api.php?action=parse&...`

Validation snapshot:

1. `pnpm run database` passes.
2. All five shield narrative fields are under 600 chars.
3. ASCII scan on shield JSON files is clean.
4. Shield images present: 5 PNG files.

## BL2 Shields Full Rollout (All 29) - 2026-02-26

Scope completed:

1. Full Lootlemon BL2 shield set (`29` items) bootstrapped into:
   - `data/games/borderlands2/shields/*.json`
2. Wiki mapping resolved for all `29` shield records.
3. Full image pass completed:
   - `29` PNGs in `data/games/borderlands2/shields/img/`
4. Full GPT-5.2 narrative rewrite completed for all `29` shields.

Output quality gates:

1. `pnpm run database` passes.
2. Narrative length gate passes:
   - max `description`: `533`
   - max `notes`: `600`
   - max `special.description`: `356`
3. ASCII scan is clean for all shield JSON files.
4. No empty `special` objects remain.

Notes:

1. Wiki category `Category:Shields_in_Borderlands_2` currently returns `44` members and includes mixed meta/type pages.
2. Shield records are seeded from the clean Lootlemon list and enriched/mapped against wiki pages.
3. Do not stop at Lootlemon-only coverage for shields. A mandatory second pass must compare against the wiki category and add BL2-relevant wiki-only shield archetype/common pages (for example `Absorb Shield`, `Adaptive Shield`, `Amplify Shield`, `Booster Shield`, `Maylay Shield`, `Nova Shield`, `Shield (Tediore)`, `Spike Shield`, `Turtle Shield`).

## BL2 Grenade Mods Pilot (First 5) - 2026-02-26

Scope completed for review (fully end-to-end):

1. `antifection.json`
2. `bonus-package.json`
3. `bouncing-betty-grenade.json`
4. `bouncing-bonny.json`
5. `breath-of-terramorphous.json`

Paths:

- JSON: `data/games/borderlands2/grenade-mods/`
- Images: `data/games/borderlands2/grenade-mods/img/`

What was completed:

1. Added BL2 grenade category folder with the first 5 populated entries.
2. Seeded from both sources:
   - Lootlemon grenade list (`26` items total available).
   - Wiki mixed category (`Category:Weapons_in_Borderlands_2`) with grenade-only filtering.
3. Included a wiki-only grenade archetype in the pilot (`Bouncing Betty Grenade`) to confirm non-Lootlemon coverage.
4. Added structured fields (`type`, `manufacturers`, `rarities`, `elements`, `sources`, `special` where present).
5. Downloaded infobox images using largest `srcset` candidate and converted to PNG.
6. Reworded long fields to British English with ASCII-safe output and no source mentions.

Schema update made:

- `src/database/schema/grenade-mods/type.schema.ts`
  - Added BL2 grenade type enum values:
    - `Bouncing Betty`
    - `Singularity`
    - `Unique`

Grenade-specific notes:

1. Wiki grenade coverage is mixed into the weapons category, so a mandatory grenade-filter pass is required.
2. Any wiki title containing `grenade` should be reviewed for BL2 relevance and merged against Lootlemon items.
3. For rewrite automation, malformed model JSON can occur occasionally; retry or manually re-author the affected file, then re-run validation.

## BL2 Grenade Mods Full Rollout (All 30) - 2026-02-26

Scope completed:

1. Full BL2 grenade mod set (`30` items) bootstrapped into:
   - `data/games/borderlands2/grenade-mods/*.json`
2. Source coverage:
   - `26` Lootlemon grenade mods.
   - `4` wiki-only grenade archetype/common pages.
3. Wiki mapping resolved for all `30` records.
4. Full image pass completed:
   - `30` PNGs in `data/games/borderlands2/grenade-mods/img/`
5. Full GPT-5.2 narrative rewrite completed for all `30` grenade mods.

Output quality gates:

1. `pnpm run database` passes.
2. Narrative length gate passes:
   - max `description`: `580`
   - max `notes`: `581`
   - max `special.description`: `324`
3. ASCII scan is clean for all grenade-mod JSON files.
4. No empty `special` objects remain.

Notes:

1. Added wiki title override mapping for `Midnight Star` -> `Captain Blade's Midnight Star` to ensure wiki URL and image resolution.
2. Global rarity rule applied to grenade mods too:
   - wiki `Unique` uses wiki `Color` tier mapping.
   - wiki `Common` archetype pages use cumulative rarities (`Common` through `Epic`) when card-name colour evidence indicates higher tiers are valid.
3. Do not stop at Lootlemon-only grenade coverage; always run a wiki mixed-category gap pass.

## BL2 Class Mods Full Rollout (All 90) - 2026-02-26

Scope completed:

1. Full BL2 class mod set (`90` items) bootstrapped into:
   - `data/games/borderlands2/class-mods/*.json`
2. Source coverage:
   - `78` Lootlemon class mods.
   - `12` wiki-only class mods (common/non-legendary lines not present in Lootlemon listing).
3. Wiki mapping resolved for all `90` records.
4. Full image pass completed:
   - `90` PNGs in `data/games/borderlands2/class-mods/img/`
5. Full GPT-5.2 narrative rewrite completed for all `90` class mods.

Schema updates made:

1. `src/database/schema/class.schema.ts`
   - Added BL2 playable classes:
     - `Assassin`
     - `Commando`
     - `Gunzerker`
     - `Mechromancer`
     - `Psycho`
2. `src/database/schema/skills.schema.ts`
   - Extended shared `Skill` enum with BL2 class-mod skill names extracted from Lootlemon/wiki coverage.

Output quality gates:

1. `pnpm run database` passes.
2. Narrative length gate passes:
   - max `description`: `402`
   - max `notes`: `529`
   - max `special.description`: `409`
3. ASCII scan is clean for all class-mod JSON files.
4. No empty `special` objects remain.

Rarity rule application (global):

1. Class mods follow the same rarity nuance as other categories.
2. Non-legendary class mods where wiki infoboxes report `Common` are represented as cumulative tiers:
   - `["Common", "Uncommon", "Rare", "Epic"]`
3. Legendary class mods remain fixed:
   - `["Legendary"]`

## BL2 Relics Full Rollout (All 31) - 2026-02-26

Scope completed:

1. Full BL2 relic set (`31` items) bootstrapped into:
   - `data/games/borderlands2/relics/*.json`
2. Source coverage:
   - `20` Lootlemon relics.
   - `11` wiki-only relic archetype/common pages.
3. Wiki mapping resolved for all `31` records.
4. Full image pass completed:
   - `31` PNGs in `data/games/borderlands2/relics/img/`
5. Full GPT-5.2 narrative rewrite completed for all `31` relics.

Schema updates made:

1. `src/database/schema/category.schema.ts`
   - Added category:
     - `relics`
2. `src/database/schema/relics/type.schema.ts`
   - Added shared relic type enum with BL2 values:
     - `Aggression`
     - `Allegiance`
     - `Elemental`
     - `Offense`
     - `Proficiency`
     - `Protection`
     - `Resistance`
     - `Stockpile`
     - `Strength`
     - `Survivability`
     - `Tenacity`
     - `Unique`
     - `Universal`
     - `Vitality`
3. `src/database/schema/index.ts`
   - Extended `type` union to include relic type schema.

Output quality gates:

1. `pnpm run database` passes.
2. Narrative length gate passes:
   - max `description`: `559`
   - max `notes`: `459`
   - max `special.description`: `360`
3. ASCII scan is clean for all relic JSON files.
4. No empty `special` objects remain.

Rarity rule application (global):

1. Relics follow the same rarity nuance as all other categories.
2. Relic archetype pages with wiki `Rarity: Common` use cumulative tiers:
   - `["Common", "Uncommon", "Rare", "Epic"]`
3. `Unique` pages use colour mapping where applicable, with Lootlemon retained as primary when direct conflicts occur.

## BL2 Grenade Mods Gap Fill (7 Wiki-Only) - 2026-02-27

Scope completed:

1. Added missing wiki-only grenade mods not present in Lootlemon listing:
   - `Corrosive Cloud`
   - `Fire Burst`
   - `Gurnade`
   - `Jumpin Biddy`
   - `Mirv`
   - `Murrv`
   - `Tesla`
2. Downloaded images for all 7:
   - `data/games/borderlands2/grenade-mods/img/*.png`
3. Rewrote narratives with GPT-5.2 for all 7.

Data rules applied:

1. Rarity nuance applied using card-name colour from downloaded images when wiki infobox rarity is `Common`.
2. Type corrections applied where behaviour is explicit:
   - `Bouncing Betty` for `Jumpin Biddy`
   - `MIRV` for `Mirv` and `Murrv`
   - `Area of Effect` for cloud/field style mods where appropriate
3. Manufacturer backfilled for `Mirv` from item-card evidence (`Torgue`).

Tooling update:

1. `.agent/scripts/rewrite-bl2-grenade-mods-narratives-openai.ts` now supports targeted rewrites:
   - `--files=slug-a,slug-b,...`
2. Use targeted rewrites when adding a small subset so existing reviewed files remain untouched.

## Maintenance Rule

When process rules change (model, limits, sourcing rules, cleanup logic), update this README immediately so the next agent can resume without re-discovery work.
