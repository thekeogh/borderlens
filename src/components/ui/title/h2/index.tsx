"use client";

import clsx from "clsx";

import Style from "../style.module.css";

import type { ReactElement, ReactNode } from "react";

/**
 * Props for the H2 component.
 */
interface Props {
  children: ReactNode
  subtitle?: string;
  className?: string;
}

export function H2({ children, subtitle, className }: Props): ReactElement {
  return (
    <h2 className={clsx(Style.root, Style.h2, className)}>
      {children}
      {subtitle ? <p>{"//"} {subtitle}</p> : null}
    </h2>
  );
}