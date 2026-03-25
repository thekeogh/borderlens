"use client";

import { Range } from "#components/pages/item/ranges/range";

import Style from "./style.module.css";

import type { Schema } from "#database/schema/types";

/**
 * Props for the Ranges component.
 */
interface Props {
  item: Schema;
}

export function Ranges({ item }: Props) {
  if (!item.ranges) {
    return null;
  }

  return (
    <section className={Style.root}>
      {item.ranges.damage && <Range type="damage" values={item.ranges.damage} />}
      {item.ranges.accuracy && <Range type="accuracy" values={item.ranges.accuracy} />}
      {item.ranges.rate && <Range type="rate" values={item.ranges.rate} />}
      {item.ranges.mag && <Range type="mag" values={item.ranges.mag} />}
    </section>
  );
}