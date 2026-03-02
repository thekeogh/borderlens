import { z } from "zod";

import { Category } from "#database/schema/category.schema";
import { Class } from "#database/schema/class.schema";
import { Content } from "#database/schema/content.schema";
import { Element } from "#database/schema/element.schema";
import { Game } from "#database/schema/game.schema";
import { Type as GrenadeModType } from "#database/schema/grenade-mods/type.schema";
import { Manufacturer } from "#database/schema/manufacturer.schema";
import { Max } from "#database/schema/max.schema";
import { Rarity } from "#database/schema/rarity.schema";
import { Type as RelicType } from "#database/schema/relics/type.schema";
import { Resource } from "#database/schema/resource.schema";
import { Type as ShieldType } from "#database/schema/shields/type.schema";
import { Skill } from "#database/schema/skills.schema";
import { Source } from "#database/schema/source.schema";
import { Special } from "#database/schema/special.schema";
import { Part } from "#database/schema/weapons/part.schema";
import { Range } from "#database/schema/weapons/range.schema";
import { Type as WeaponType } from "#database/schema/weapons/type.schema";

export const Schema = z.object({
  game: Game.describe(
    "Specifies the game context for this item (e.g., Borderlands, Borderlands 2)."
  ),
  category: Category.describe(
    "Primary item category; drives app category selection and filtering."
  ),
  content: Content.describe(
    "Whether the item is from the base game or a specific DLC."
  ),
  dlc: z.boolean().describe(
    "True when the item is from DLC content; false for base game only."
  ),
  image: z.string().describe(
    "Public image path displayed in the app to represent this item."
  ).describe(
    "Note for LLM: When generating this schema, collect the image from the Wiki (not Lootlemon), css selector #mw-content-text > div > aside > figure[data-source='img'] img. Store the image as a PNG file in an 'img/' subfolder within the same directory as the schema (e.g. data/games/borderlands/weapons/img). Name the image file the same as the schema JSON file (for example, hellfire.png for hellfire.json)."
  ),
  resources: Resource.describe(
    "External reference URLs (Lootlemon, Wiki, or both) for this item."
  ),
  name: z.string().describe(
    "Display name of the item."
  ),
  aliases: z.array(z.string()).optional().describe(
    "Alternative names for this item (renames, regional names, or known variants) used for search and matching."
  ),
  slug: z.string().describe(
    "URL-friendly identifier derived from the name; concise, no double dashes or extraneous characters."
  ),
  type: z.union([WeaponType, GrenadeModType, ShieldType, RelicType, Class]).describe(
    "Subcategory within the main category (e.g. SMG for weapons, Transfusion for grenade mods)."
  ),
  description: z.string().describe(
    "Original item description synthesised from sources; must be reworded rather than copied."
  ),
  skills: z.array(Skill).optional().describe(
    "Class-mod only. Skills that this class mod can affect for its class."
  ),
  notes: z.string().optional().describe(
    "Supplementary notes not covered by other fields."
  ),
  abilities: z.array(z.string()).optional().describe(
    "Card-derived gameplay effects and utility lines from Lootlemon item cards, excluding red text/manufacturer/value."
  ),
  manufacturers: z.array(Manufacturer).describe(
    "Manufacturers that can produce this item. Typically one; some items can be made by multiple."
  ),
  elements: z.array(Element).optional().describe(
    "Elemental types (Incendiary, Corrosive, Shock, etc.). Used for weapons and shields; shields may list resistance elements."
  ),
  rarities: z.array(Rarity).describe(
    "Rarity tiers the item can roll. Legendary and above usually have one; lower tiers often have multiple variants."
  ),
  special: Special.optional().describe(
    "Red flavour text and effect description for notable items. Present on all Legendary+; some Epic and Rare items also include it."
  ),
  ranges: Range.optional().describe(
    "Min–max stat ranges (mainly BL1). Mostly for weapons; BL2+ sources rarely provide this."
  ),
  parts: Part.optional().describe(
    "All possible parts this item can roll with, including modifiers. Parts determine god-roll potential."
  ),
  max: Max.optional().describe(
    "Peak DPS stats for this item. Sourced from Lootlemon's Item Card image; not available on Wiki."
  ),
  sources: z.array(Source).describe(
    "Where this item can drop (quests, bosses, areas). Lootlemon is the primary source for this data."
  ),
}).strict();
