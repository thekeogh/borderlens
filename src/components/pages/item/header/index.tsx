"use client";

import { IoSkullSharp } from "react-icons/io5";

import { manufacturerCount } from "#utils/items";
import { formatLineBreaks } from "#utils/string";

import { GameIcon } from "#components/features/game-icon";
import { Item } from "#components/features/item";

import Style from "./style.module.css";

import type { Schema } from "#database/schema/types";

/**
 * Props for the Header component.
 */
interface Props {
  item: Schema;
}

/**
 * Renders the header section of an item page with image, rarities, metadata, and special effects.
 *
 * @param item - The item data to display in the header.
 */
export function Header({ item }: Props) {

  /**
   * Renders a grouped collection of item elements.
   *
   * @returns A JSX element containing grouped elements, or null if elements are not available.
   */
  const elements = () => {
    if (!item.elements) {
      return null;
    }
    return (
      <Item.Element.Group size="lg" className={Style.elements}>
        {item.elements.map(element => (
          <Item.Element key={element} size="lg" element={element} />
        ))}
      </Item.Element.Group>
    );
  };

  return (
    <header className={Style.root}>
      <div className={Style.corner} /><div className={Style.corner} /><div className={Style.corner} /><div className={Style.corner} />

      <div className={Style.left}>
        <div className={Style.img}>
          {elements()}
          <Item.Image src={item.image} alt={item.name} />
        </div>
        <Item.Rarity.Group direction="horizontal" className={Style.rarities}>
          {item.rarities.map(rarity => (
            <Item.Rarity key={rarity} size="lg" rarity={rarity} />
          ))}
        </Item.Rarity.Group>
      </div>
      <div className={Style.right}>
        <GameIcon label game={item.game} className={Style.game} />
        <h1>{item.name}</h1>
        <ul className={Style.meta}>
          <li>{item.type}</li>
          <li>{item.manufacturers[0]} {manufacturerCount(item.manufacturers)}</li>
        </ul>
        {item.special && (
          <aside>
            <div><IoSkullSharp className={Style.icon} /> Special Effect</div>
            {item.special.title && <strong>{item.special.title}</strong>}
            {formatLineBreaks(item.special.description)}
          </aside>
        )}
      </div>

    </header>
  );
}