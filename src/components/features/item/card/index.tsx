"use client";

import clsx from "clsx";

import { Image } from "#components/features/item/image";

import Style from "./style.module.css";

import type * as Types from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Card component.
 */
interface Props {
  game: Types.Game;
  name: string;
  slug: string;
  image: string;
  category: Types.Category;
  manufacturers: Types.Manufacturer[];
  rarities: Types.Rarity[];
  elements?: Types.Element[];
  className?: string;
  style?: CSSProperties;
}

export function Card(props: Props) {
  return (
    <article className={clsx(Style.root, props.className)} style={props.style}>
      <div className={Style.img}>
        <Image src={props.image} alt={props.name} />
      </div>
    </article>
  );
}