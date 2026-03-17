"use client";

import clsx from "clsx";

import { generateKey } from "#utils/items";

import { Item } from "#components/features/item";
import { Heading } from "#components/ui/heading";

import Style from "./style.module.css";

import type { Schema  } from "#database/schema/types";
import type { CSSProperties, ReactElement } from "react";

/**
 * Props for the Items component.
 */
interface Props {
  items: Schema[];
  title: ReactElement;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a section displaying a list of items with a custom title.
 *
 * @param items - The array of item data to be displayed.
 * @param title - The React element used as the section heading.
 * @param className - An optional additional class name for styling the section.
 * @param style - Optional inline CSS properties for the section.
 */
export function Items({ items, title, className, style }: Props) {
  const count = items.length;
  return (
    <section className={clsx(Style.root, className)} style={style}>
      <div className="container pad-xl">
        <Heading.H2 subtitle={`Showing ${count} item${count !== 1 ? "s" : ""}`}>
          {title}
        </Heading.H2>
        <Item.Card.Group>
          {items.map(item => (
            <Item.Card
              key={generateKey(item)}
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
        </Item.Card.Group>
      </div>
    </section>
  );
}