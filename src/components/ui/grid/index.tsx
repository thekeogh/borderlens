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

export function Grid({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}