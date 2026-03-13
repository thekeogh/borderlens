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

export function Group({ children, direction = "vertical", className, style }: Props) {
  return (
    <div className={clsx(Style.root, Style[direction], className)} style={style}>
      {children}
    </div>
  );
}