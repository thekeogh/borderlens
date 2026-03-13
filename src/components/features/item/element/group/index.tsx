"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the Group component.
 */
interface Props {
  children: ReactNode;
  size?: "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a group container for element icons or related children.
 *
 * @param children - The child nodes to be displayed within the group.
 * @param className - Optional additional class name(s) for custom styling.
 * @param style - Optional inline CSS properties to apply to the container.
 */
export function Group({ children, size = "md", className, style }: Props) {
  return (
    <div className={clsx(Style.root, Style[size], className)} style={style}>
      {children}
    </div>
  );
}