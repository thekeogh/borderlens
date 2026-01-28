import type { Types } from "#database";

/**
 * Converts a rarity type to its corresponding CSS class name.
 *
 * @param rarity - The rarity level of the weapon
 * @param scope - The scope of the CSS class, either "color" for text color or "background" for background color
 * @returns A CSS class name string in the format "rarity-(level)-(scope)" (e.g., "rarity-legendary-color")
 *
 * @example
 * ```ts
 * toClassName("Legendary", "color") // Returns "rarity-legendary-color"
 * toClassName("Common", "background") // Returns "rarity-common-background"
 * ```
 */
export function toClassName(rarity: Types.Rarity, scope: "color" | "background"): string {
  const prefix = "rarity";
  let className: string;
  switch (rarity) {
    case "Common":
      className = "common";
      break;
    case "Uncommon":
      className = "uncommon";
      break;
    case "Rare":
      className = "rare";
      break;
    case "Epic":
      className = "epic";
      break;
    case "Legendary":
      className = "legendary";
      break;
    case "Pearlescent":
      className = "pearlescent";
      break;
    default:
      return "";
  }
  return `${prefix}-${className}-${scope}`;
}
