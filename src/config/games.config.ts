import type { Category, Game } from "#database/schema/types";
import type { Stat } from "#database/schema/types";
/**
 * Maps each game identifier to its display name.
 */
export const Title: Record<Game, string> = {
  borderlands: "Borderlands",
  borderlands2: "Borderlands 2",
};

/**
 * Provides navigation labels for each game and category combination.
 *
 * @remarks
 * This mapping allows retrieval of the display names for categories within each game, facilitating dynamic navigation
 * generation or UI labelling. Only relevant categories for each game are included.
 */
export const Navigation: Record<Game, Partial<Record<Category, string>>> = {
  borderlands: {
    "weapons": "Weapons",
    "shields": "Shields",
    "grenade-mods": "Grenade Mods",
    "class-mods": "Class Mods",
  },
  borderlands2: {
    "weapons": "Weapons",
    "shields": "Shields",
    "grenade-mods": "Grenade Mods",
    "class-mods": "Class Mods",
    "relics": "Relics",
  },
};

/**
 * Maps weapon statistic keys to their display names.
 */
export const Stats: Record<Stat, string> = {
  accuracy: "Accuracy",
  damage: "Damage",
  mag: "Magazine size",
  rate: "Fire rate",
};