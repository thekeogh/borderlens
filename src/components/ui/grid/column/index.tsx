"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement, ReactNode } from "react";

/**
 * Props for the Column component.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a grid column component.
 *
 * @param children - The content to render inside the column
 * @param className - Optional additional CSS classes to apply
 * @returns The rendered column element
 */
export function Column({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}