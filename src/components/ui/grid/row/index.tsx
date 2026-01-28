"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { ReactElement } from "react";

/**
 * Props for the Row component.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

export function Row({ children, className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      {children}
    </div>
  );
}