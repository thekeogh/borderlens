"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the H2 component.
 */
interface Props {
  children: ReactNode;
  subtitle?: string;
  className?: string;
  style?: CSSProperties;
}

export function H2({ children, subtitle, className, style }: Props) {
  return (
    <h2 className={clsx(Style.root, className)} style={style}>
      {children}
      {subtitle && (
        <p>{"//"} {subtitle}</p>
      )}
    </h2>
  );
}