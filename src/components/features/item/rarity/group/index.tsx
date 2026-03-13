"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the Group component.
 */
interface Props {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a group container for rarity-related content.
 *
 * @param children - The child nodes to be displayed within the group.
 * @param direction - The layout direction, either "horizontal" or "vertical". Defaults to "vertical".
 * @param className - Optional additional class name(s) for custom styling.
 * @param style - Optional inline CSS properties to apply to the container.
 */
export function Group({ children, direction = "vertical", className, style }: Props) {
  return (
    <div className={clsx(Style.root, Style[direction], className)} style={style}>
      {children}
    </div>
  );
}