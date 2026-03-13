import type { Rarity } from "#database/schema/types";

/**
 * Gets the highest rarity level from an array of rarities.
 *
 * @param rarity - An array of rarity levels
 * @returns The highest rarity level from the array
 *
 * @example
 * ```ts
 * getHighestRarity(["Common", "Uncommon", "Rare"]) // Returns "Rare"
 * getHighestRarity(["Legendary"]) // Returns "Legendary"
 * ```
 */
export function getHighestRarity(rarities: Rarity[]): Rarity {
  return rarities.at(-1) as Rarity;
}