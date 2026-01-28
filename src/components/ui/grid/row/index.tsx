"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement, ReactNode } from "react";

/**
 * Props for the Row component.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a grid row component.
 *
 * @param children - The content to render inside the row
 * @param className - Optional additional CSS classes to apply
 * @returns The rendered row element
 */
export function Row({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}