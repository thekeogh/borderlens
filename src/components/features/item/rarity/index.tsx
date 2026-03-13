"use client";

import clsx from "clsx";

import { Group } from "#components/features/item/rarity/group";

import Style from "./style.module.css";

import type * as Types from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Rarity component.
 */
interface Props {
  rarity: Types.Rarity;
  size?: "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a rarity label with appropriate styling and colouring based on the rarity type.
 *
 * @param rarity - The rarity type to be displayed.
 * @param size - The size of the label, either "md" or "lg". Defaults to "md".
 * @param className - Optional additional class name(s) for custom styling.
 * @param style - Optional inline CSS properties to apply to the label.
 */
function Rarity({ rarity, size = "md", className, style }: Props) {
  return (
    <div
      className={clsx(Style.root, Style[size], className)}
      style={{ ...style, backgroundColor: `var(--color-rarity-${rarity.toLowerCase()})` }}
      title={rarity}
    >
      {rarity}
    </div>
  );
}

Rarity.Group = Group;

export { Rarity };