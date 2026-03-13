"use client";

import clsx from "clsx";

import { Item } from "#components/features/item";
import { Heading } from "#components/ui/heading";

import Style from "./style.module.css";

import type { Schema } from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Showcase component.
 */
interface Props {
  items: Schema[];
  className?: string;
  style?: CSSProperties;
}

export function Showcase({ items, className, style }: Props) {
  return (
    <section className={clsx(Style.root, className)} style={style}>
      <div className="container">
        <Heading.H2 subtitle="Iconic items from across the Borderlands universe">
          Legendary <span>Arsenal</span>
        </Heading.H2>
        <Item.Group>
          {items.map(item => (
            <Item.Card
              key={`${item.game}-${item.category}-${item.slug}`}
              game={item.game}
              name={item.name}
              slug={item.slug}
              image={item.image}
              category={item.category}
              manufacturers={item.manufacturers}
              rarities={item.rarities}
              elements={item.elements}
            />
          ))}
        </Item.Group>
      </div>
    </section>
  );
}