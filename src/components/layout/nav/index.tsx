"use client";

import clsx from "clsx";

import { Item } from "#components/layout/nav/item";

import Style from "./style.module.css";

import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the Nav component.
 */
interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a navigation container for child navigation items.
 *
 * @param children - The navigation items to be displayed within the navigation bar.
 * @param className - Optional additional CSS class names to apply to the navigation element.
 * @param style - Optional inline styles for the navigation component.
 */
function Nav({ children, className, style }: Props) {
  return (
    <nav className={clsx(Style.root, className)} style={style}>
      {children}
    </nav>
  );
}

Nav.Item = Item;
export { Nav };