import type { Manufacturer, Schema } from "#database/schema/types";
import type { ReactNode } from "react";

/**
 * Renders a manufacturer count badge displaying the number of additional manufacturers.
 *
 * @remarks
 * When there is only one manufacturer, this function returns an empty string. For multiple manufacturers, it displays a
 * badge showing the count of additional manufacturers beyond the first, with a tooltip listing all manufacturers.
 *
 * @param manufacturers - Array of manufacturers to count.
 * @returns A React element displaying the count badge, or an empty string if only one
 *   manufacturer exists.
 */
export function manufacturerCount(manufacturers: Manufacturer[]): ReactNode {
  if (manufacturers.length === 1) {
    return "";
  }
  return <span className="muted" style={{ cursor: "default" }} title={manufacturers.join(", ")}>+{manufacturers.length - 1}</span>;
}

/**
 * Generates a unique key string for a catalogue item based on its game, category, and slug.
 *
 * @param item - The catalogue item for which to generate the key.
 * @returns The unique key string representing the item.
 */
export function generateKey(item: Schema): string {
  return `${item.game}-${item.category}-${item.slug}`;
}