import type { Types } from "#database";

/**
 * Converts a element type to its corresponding CSS class name.
 *
 * @param element - The element level of the weapon
 * @param scope - The scope of the CSS class, either "color" for text color or "background" for background color
 * @returns A CSS class name string in the format "element-(level)-(scope)" (e.g., "element-corrosive-color")
 *
 * @example
 * ```ts
 * toClassName("Corrosive", "color") // Returns "element-corrosive-color"
 * toClassName("Shock", "background") // Returns "element-shock-background"
 * ```
 */
export function toClassName(element: Types.Element, scope: "color" | "background"): string {
  const prefix = "element";
  let className: string;
  switch (element) {
    case "Incendiary":
      className = "incendiary";
      break;
    case "Corrosive":
      className = "corrosive";
      break;
    case "Explosive":
      className = "explosive";
      break;
    case "Shock":
      className = "shock";
      break;
    default:
      return "";
  }
  return `${prefix}-${className}-${scope}`;
}
