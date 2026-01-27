"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement, ReactNode } from "react";

/**
 * Props for the Section component.
 */
interface Props {
  children: ReactNode;
  width?: "100%" | "wide" | "narrow";
  padding?: "sm" | "md" | "lg";
  separator?: boolean;
  className?: string;
}

/**
 * Renders a section component with configurable width, padding, and separator.
 *
 * @param children - The content to render inside the section
 * @param width - The width constraint: "100%" for full width, "wide" (default) or "narrow" for constrained widths
 * @param padding - The padding size: "sm", "md", or "lg"
 * @param separator - Whether to display a separator below the section (default: false)
 * @param className - Additional CSS class names to apply to the section
 * @returns The rendered section element
 */
export function Section({ children, width = "wide", padding, separator = false, className }: Props): ReactElement {
  const classes = clsx(
    Style.root,
    className,
    Style[`padding-${padding}`],
    separator && Style.separator
  );
  return (
    <section className={classes}>
      {width !== "100%" ? (<div className={Style[width]}>{children}</div>) : ( children )}
    </section>
  );
}