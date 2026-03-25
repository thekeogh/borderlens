"use client";

import { Item } from "#components/layout/nav/item";

import Style from "./style.module.css";

import type { ReactNode } from "react";

/**
 * Props for the Nav component.
 */
interface Props {
  children: ReactNode;
}

/**
 * Renders a navigation container for child navigation items.
 *
 * @param children - The navigation items to be displayed within the navigation bar.
 */
function Nav({ children }: Props) {
  return (
    <nav className={Style.root}>
      {children}
    </nav>
  );
}

Nav.Item = Item;
export { Nav };