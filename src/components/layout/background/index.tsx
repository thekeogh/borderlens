"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactNode, CSSProperties } from "react";

/**
 * Props for the Background component.
 */
interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders the application background with visual effects and wraps the main content area.
 *
 * @param children - The content to be displayed within the background.
 * @param className - Optional additional class names to apply to the root element.
 * @param style - Optional inline styles to apply to the root element.
 */
export function Background({ children, className, style }: Props) {
  return (
    <div className={clsx(Style.root, className)} style={style}>
      <div className={Style.scanlines} aria-hidden="true" />
      <div className={Style.noise} aria-hidden="true" />
      <main>
        {children}
      </main>
    </div>
  );
}