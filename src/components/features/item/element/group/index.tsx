"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the Group component.
 */
interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Group({ children, className, style }: Props) {
  return (
    <div className={clsx(Style.root, className)} style={style}>
      {children}
    </div>
  );
}