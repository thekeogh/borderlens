"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement, ReactNode } from "react";

/**
 * Props for the Grid component.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a grid component.
 *
 * @param children - The content to render inside the grid
 * @param className - Optional additional CSS classes to apply
 * @returns The rendered grid element
 */
export function Grid({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}