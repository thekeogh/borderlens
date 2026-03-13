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