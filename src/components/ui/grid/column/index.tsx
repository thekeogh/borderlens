"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement } from "react";

/**
 * Props for the Column component.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

export function Column({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}