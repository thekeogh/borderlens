# Schema Guide

This guide documents the complete data schema for all items in the application. All data is stored in `.json` files located in the `/.data/` folder. It serves as a reference for both humans and AI agents to understand schema structure and requirements. Each schema component includes a corresponding Zod validator to maintain data integrity throughout the application.

## The JSON

Below is an example of the JSON schema structure with brief explanations. For detailed information about each field, refer to [The Schema](#the-schema) section below.

```jsonc
{
  // Base game or DLC name (e.g. "Base Game", "Knoxx")
  "content": "",
  // Whether this is a DLC item
  "dlc": false,
  // Local image paths
  "images": {
    "item": "../img/item",
    "card": "../img/card"
  },
  // Source links for reference and scraping
  "resources": {
    "lootlemon": "",
    "wiki": ""
  },

  // Weapon name
  "name": "",
  // Weapon type (e.g. SMG, Repeater Pistol)
  "type": "",
  // Description combining Lootlemon and wiki information
  "description": "",
  // Additional notes from the wiki (reworded, no bullets)
  "notes": "",
  // Manufacturer(s) - weapons can have multiple
  "manufacturer": [],
  // Elements - empty array means no elements
  "elements": ["Incendiary"],
  // Element multiplier (e.g. fire x4). Omit if no multiplier. Format: [min, max] or [static]
  "multiplier": [1, 4],
  // Rarity level(s) - some weapons have multiple (e.g. Green and Blue)
  "rarity": [],
  // Special weapon effects
  "special": {
    // Red text effect
    "red": "",
    // Description combining Lootlemon and wiki information
    "description": ""
  },

  // Min and max ranges from wiki. Format: [min, max] or [static]
  "ranges": {
    "damage": [100, 200],
    "accuracy": [50, 100],
    "rate": [1, 10.5],
    "mag": [20, 40]
  },
  // Gun parts (Barrel, Stock, etc). Omit if fixed parts. Format from Lootlemon parts section
  "parts": {
    "Body": [{
      "name": "Body_1",
      "modifiers": [
        "+15% Damage",
        "-20% Max Inaccuracy"
      ]
    }],
    "Barrel": [],
    "Magazine": [],
    "Stock": [],
    "Sight": [],
    "Accessory": [],
    "Material": []
  },
  // Maximum stats at highest rarity (from Lootlemon images)
  "max": {
    "damage": 271,
    "accuracy": 89.2,
    "fire_rate": 12.5,
    "mag_size": 36,
    "level": 69
  },

  // Where this weapon can be found (from Lootlemon All Sources)
  "source": [{
    "name": "SMG Pool",
    "tags": []
  }]
}
```

## The Schema

This section provides detailed explanations for each field in the weapon schema, including data sources and collection methods.

### `content`

#### Type
`enum`
- `Base Game`
- `The Zombie Island of Dr. Ned`
- `Mad Moxxi's Underdome Riot`
- `The Secret Armory of General Knoxx`
- `Claptrap's New Robot Revolution`
- `Enhanced`

#### Required
`true`

#### Description
Specifies which game content this weapon is available from. This includes the base game and all available DLC packs. Use the exact content name as the value. This field helps players identify which version of the game they need to own to obtain the weapon.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** Right hand column under the label "Content".
- **HTML Element:** `#item-origin`

----

### `dlc`

#### Type
`boolean`

#### Required
`true`

#### Description
Indicates whether this weapon is exclusive to DLC content. Set to `true` if the weapon is only available in a DLC pack and cannot be obtained in the base game. Set to `false` if the weapon is available in the base game (regardless of whether it also appears in DLC).

#### Location
- **Source:** Derived from the `content` field above. Set to `true` when `content !== "Base Game"`, otherwise `false`.

----

### `images`
#### Type
`object`
- `item`: `string`
- `card`: `string`

#### Required
`false`

#### Description
Contains URLs or local paths to weapon images. The `item` field stores the full item render image, while the `card` field stores the item statistics card. Both fields should be strings representing a relative path to the image from the schema.

#### Location
- **Source:** `Lootlemon`
- **Site Location:**
  - `item`: The main image of the item at the top of the page.
  - `card`: Further down below the "All Details" heading.
- **HTML Element:**
  - `item`: `img#page-image`,
  - `card`: `img#item-card`,

----

### `resources`
#### Type
`object`
- `lootlemon`: `string`
- `wiki`: `string`

#### Required
`true`

#### Description
Contains URLs to external reference sources for the weapon data. The `lootlemon` field stores the URL to the weapon page on Lootlemon, while the `wiki` field stores the URL to the corresponding wiki page. These fields are predefined in the `.json` schema as they are used by the AI agent to know where to scrape all the data from.

#### Note for AI
These fields are predefined in the `.json` schema as they are used by the AI agent to know where to scrape all the data from.

#### Location
- **Source:** Predefined in the schema - these URLs are already populated and ready to use.

----

### `name`
#### Type
`string`

#### Required
`true`

#### Description
The display name of the item. This is a human-readable identifier that represents the item's title, such as "Hellfire" or "Legendary Vault Hunter Shield". The name should be descriptive and include relevant game or content information when applicable.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** Main heading on the right hand side of the image.
- **HTML Element:** `h1.article_heading span:nth-of-type(2)`

----

### `type`
#### Type
`enum`
- `Repeater`
- `Revolver`
- `SMG`
- `Assualt rifle`
- `Shotgun`
- `Sniper`
- `Launcher`
- `Eridian`

#### Required
`true`

#### Description
The category or classification of the item. This field categorises items into distinct types based on their mechanical properties and gameplay behavior. Each item belongs to one specific type. E.g weapon type, shield type etc.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** Right hand column under the label "Weapon Type".
- **HTML Element:** `#item-type`

----

### `description`
#### Type
`string`

#### Required
`false`

#### Description
A detailed textual description of the item that combines information from both Lootlemon and the wiki. The AI agent retrieves descriptions from both sources, merges them, and rewrites them in clear, cohesive English to provide a comprehensive overview of the item's characteristics, abilities, and gameplay significance.

#### Note for AI
Remove all HTML tags and formatting from these descriptions, keeping only plain text content. The AI agent merges information from both Lootlemon and wiki sources, rewrites them into clear, cohesive English sentences, and ensures the final output contains no HTML formatting. Ignore any content not present in one of the sources.

#### Location
- **Source:** `Lootlemon`, `wiki`
- **Site Location:**
  - `Lootlemon`: Top content in the "About" section. DO NOT INCLUDE the "Unigue Ability" content.
  - `wiki`: Under the heading "Usage" or "Description" or "Usage & Description" of "Description & Usage". The name changes on this site so use a fuzzy/keyword scrap for this.
- **HTML Element:**
  - `Lootlemon`: `#w-tabs-0-data-w-pane-0 span:nth-of-type(2) p`
  - `wiki`: Below `.mw-parser-output h2` in a `p`

----

### `notes`

#### Type
`string`

#### Required
`false`

#### Description
Additional context pulled from the wiki "Notes" section (and other relevant sections like "Mechanics" when useful). Reword the content into clear sentences and merge bullet points into prose. Paragraph breaks are allowed.

#### Location
- **Source:** `wiki`
- **Site Location:** "Notes" section
- **HTML Element:** `h2` with "Notes" heading and following content

----

### `manufacturer`
#### Type
`enum`
- `Atlas`
- `Dahl`
- `Eridian`
- `Hyperion`
- `Jakobs`
- `Maliwan`
- `S&S Munitions`
- `Tediore`
- `Torgue`
- `Vladof`

#### Required
`true`

#### Description
The manufacturer or creator of the item. This field identifies which company or faction produced the item, determining its brand identity and often correlating with specific mechanical characteristics and design philosophies. Each item is produced by exactly one manufacturer.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** Right hand column under the label "Weapon Type".
- **HTML Element:** `#item-manufacturer`

----

### `elements`
#### Type
`enum[]`
- `Incendiary`
- `Corrosive`
- `Shock`
- `Explosive`

#### Required
`false`

#### Description
An array of elemental damage types that the item can inflict. Elements represent special damage properties beyond standard physical damage, each with unique effects and interactions in combat. An item may have zero, one, or multiple elements. E.g. Incendiary, Corrosive etc.

#### Note for AI
An item can have multiple, one, or no elements. Use initiative when scraping to determine which elements apply. If an item has no elements omit the field

#### Location
- **Source:** `Lootlemon` or `wiki`
- **Site Location:**
  - `Lootlemon`: Uses an icon on the right side but the name of the icon file can be used to determine. Do not use `alt` as this is different.
  - `wiki`: Right hand card under the "Element" label.
- **HTML Element:**
  - `Lootlemon`: `.stat_value-icon-grid > div img`
  - `wiki`: `div[data-source="element"] div.pi-data-value span`

----

### `multiplier`
#### Type
`[number] | [number, number]`

#### Required
`false`

#### Description
The multiplier applied to an element's damage output. An empty array means the item has no multiplier, a single element array means the multiplier is fixed at that value, and a two-element array represents the minimum and maximum multiplier range. For example, a weapon might have a Damage multiplier of `x2` (fixed), `[1, 4]` (ranges from 1x to 4x), or omit (no multiplier).

#### Note for AI
The wiki is inconsistent with multiplier formatting. You may find it displayed in the element description in various formats such as "Incendiary ×4" or "Any ×1 – ×4". The consistent indicator is the "×" character followed by the multiplier value(s). Use this as your anchor point when parsing multiplier data from the wiki. Use initative to determine the correct value(s) for this field.

#### Location
- **Source:** `wiki`
- **Site Location:** Right hand card under the "Element" label after the "x" character.
- **HTML Element:** `div[data-source="element"] div.pi-data-value span`

----

### `rarity`
#### Type
`enum[]`
- `Common`
- `Uncommon`
- `Rare`
- `Epic`
- `Legendary`
- `Pearlescent`

#### Required
`true`

#### Description
The rarity level of the weapon. While a weapon can only ever have one rarity at a time, some weapons (notably Rider) can appear in multiple rarities across different sources. For this reason, the field is represented as an array. However, in practice, the scraped data will likely contain only a single rarity value per weapon entry.

#### Note for AI
While a weapon can theoretically have multiple rarities (as some weapons like Rider appear in different rarities across different sources), in practice you will almost always encounter only a single rarity value per weapon entry. Look for multiple rarities if present, but expect to find just one in most cases.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** Right hand column under the label "Rarity".
- **HTML Element:** `#item-rarity`

----

### `special`
#### Type
`object`
- `red`: `string`
- `description`: `string`

#### Required
`false`

#### Description
The special effects and attributes of the weapon. The `red` field contains the red text that appears on special weapons, and the `description` field describes the special effects that make the weapon unique.

#### Note for AI
This field will only be present for special weapons (Legendary and above). If a weapon doesn't have special effects, this field can be omitted completely. The `red` text should only be sourced from Lootlemon. For the `description`, gather information from both Lootlemon and wiki sources, then merge, reword, and ensure the final text is clear, readable English.

#### Location
- **Source:** `Lootlemon`, `wiki`
- **Site Location:**
  - `Lootlemon`:
    - `red`: Red text on the right hand sinde below the item name
    - `description`: Top content in the "About" section under the "Unigue Ability" heading.
  - `wiki`:
    - `description`: White text appearing after the red text under the "Special Weapon Effects" heading
- **HTML Element:**
  - `Lootlemon`:
    - `red`: `#red-text`
    - `description`: `div[data-w-tab="Details"] div.framed-txt div.w-richtext`
  - `wiki`:
    - `description`: Extract text from the `<p>` containing `<span class="text-flavor">`, excluding the span's content.

----

### `ranges`
#### Type
`object`
- `damage`: `[number] | [number, number]`
- `accuracy`: `[number] | [number, number]`
- `rate`: `[number] | [number, number]`
- `mag`: `[number] | [number, number]`

#### Required
`false`

#### Description
The minimum and maximum values for each weapon stat. Each stat can be represented as either a single static value (e.g., `[50]`, although extremelly unlikely) or a range with minimum and maximum values (e.g., `[50, 100]`). These ranges represent the possible stat values a weapon can have based on its rarity level and item parts. If no ranges are found, then omit this field.

#### Location
- **Source:** `wiki`
- **Site Location:** Right had aside containing stats about the item
- **HTML Element:** Extract the damage value from `<div class="pi-data-value">` where the preceding `<h3>` contains "`(Damage|Accuracy|Fire Rate|Magazine Capacity):`".

----

### `parts`
#### Type
`object`
- `Body`: `array` of `object`
- `Barrel`: `array` of `object`
- `Magazine`: `array` of `object`
- `Stock`: `array` of `object`
- `Sight`: `array` of `object`
- `Accessory`: `array` of `object`
- `Material`: `array` of `object`

Each part object contains:
- `name`: `string`
- `modifiers`: `array` of `string`

#### Required
`false`

#### Description
The gun parts that can be equipped on the weapon. Each part category (Body, Barrel, Magazine, Stock, Sight, Accessory, Material) contains an array of possible parts. Each part has a name and a list of modifiers that affect weapon stats. If a weapon has fixed parts (cannot be changed), this field can be omitted entirely.

#### Note for AI
If the "Parts" section is not present on the Lootlemon page, this means the weapon has fixed parts that cannot be changed. In this case, omit the `parts` field entirely from the schema.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** "Parts" tab that appears under the "All Details" section.
- **HTML Element:** `div.rich-txt_parts-new`

----

### `max`
#### Type
`object`
- `damage`: `number`
- `accuracy`: `number`
- `fire_rate`: `number`
- `mag_size`: `number`
- `level`: `number`

#### Required
`false`

#### Description
The maximum DPS stats for the weapon at its highest level. This field contains the peak values for damage, accuracy, fire rate, magazine size, and level that the weapon can achieve.

#### Note for AI
This field is predefined in the schema as it comes from the card image. AI does not need to scrape or populate this field - it will already be present in the JSON.

#### Location
- **Source:** Predefined in the schema - this value is already populated and ready to use.

----

### `source`
#### Type
`array` of `object`

Each source object contains:
- `name`: `string`
- `tags`: `array` of `string`

#### Required
`true`

#### Description
Specifies where the weapon can be obtained in the game. This field contains an array of source objects, each representing a location or loot pool where the weapon can be found. The `name` field describes the source (e.g., "SMG Pool", "Boss Drop"), and the `tags` array can contain additional metadata or categories related to that source.

#### Note for AI
This field is derived from the Lootlemon "All Sources" section and should be populated based on the sources listed there. You will see the tags inside this element as well.

#### Location
- **Source:** `Lootlemon`
- **Site Location:** "All Sources" section on foot of the page
- **HTML Element:** `#loot-source-grid .card`
