import { z } from "zod";

import { Schema } from "./schema";

/**
 * Inferred type from the Schema validation schema.
 */
export type Schema = z.infer<typeof Schema>;

/**
 * Type representing the content/DLC source of a weapon.
 */
export type Content = Schema["content"];

/**
 * Type representing the weapon type/category.
 */
export type Type = Schema["type"];

/**
 * Type representing the weapon manufacturer.
 */
export type Manufacturer = Schema["manufacturer"][number];

/**
 * Type representing the weapon element.
 */
export type Element = NonNullable<Schema["elements"]>[number];

/**
 * Type representing the weapon rarity.
 */
export type Rarity = Schema["rarity"][number];

/**
 * Type representing the weapon special properties.
 */
export type Special = Schema["special"];

/**
 * Type representing the weapon ranges (damage, accuracy, rate, mag).
 */
export type Ranges = Schema["ranges"];

/**
 * Type representing the weapon parts (body, barrel, magazine, stock, sight, accessory, material).
 */
export type Parts = Schema["parts"];

/**
 * Type representing the weapon maximum stats (damage, accuracy, fire rate, magazine size, level).
 */
export type Max = Schema["max"];

/**
 * Type representing the weapon sources.
 */
export type Source = Schema["source"];
