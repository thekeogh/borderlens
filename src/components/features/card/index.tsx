"use client";

import clsx from "clsx";

import Style from "./style.module.css";

import type { Types } from "#database";
import type { ReactElement } from "react";

/**
 * Props for the Card component.
 */
interface Props {
  name: string;
  image: string;
  type: Types.Type;
  manufacturer: Types.Manufacturer[];
  rarity: Types.Rarity[];
  elements?: Types.Element[];
  special?: Types.Special;
  ranges?: Types.Ranges;
  className?: string;
}

export function Card({ className }: Props): ReactElement {
  return (
    <article className={clsx(Style.root, className)}>
      lkjklj
    </article>
  );
}