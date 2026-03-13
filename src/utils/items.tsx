import type { Manufacturer } from "#database/schema/types";
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