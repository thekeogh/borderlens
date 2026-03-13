"use client";

import clsx from "clsx";
import Link from "next/link";
import { HiChevronDoubleRight } from "react-icons/hi";

import { Config } from "#config";

import { manufacturerCount } from "#utils/items";
import { getHighestRarity } from "#utils/rarities";

import { GameIcon } from "#components/features/game-icon";
import { Group } from "#components/features/item/card/group";
import { Element } from "#components/features/item/element";
import { Image } from "#components/features/item/image";
import { Rarity } from "#components/features/item/rarity";

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

/**
 * Renders an item card displaying core item details, including image, rarity, and associated elements.
 *
 * @param props - The properties required to render the card.
 */
function Card(props: Props) {
  const url = Config.Routes.item(props.game, props.category, props.slug);
  const rarity = getHighestRarity(props.rarities).toLowerCase();

  const elements = () => {
    if (!props.elements) {
      return null;
    }
    return (
      <Element.Group className={Style.elements}>
        {props.elements.map(element => (
          <Element key={element} element={element} />
        ))}
      </Element.Group>
    );
  };

  return (
    <article
      className={clsx(Style.root, props.className)}
      style={{ ...props.style, "--color": `var(--color-rarity-${rarity})` } as React.CSSProperties}
    >
      <header>
        <GameIcon game={props.game} className={Style.game} />
        {elements()}
        <Image href={url} src={props.image} alt={props.name} />
      </header>
      <main>
        <div className={Style.meta}>
          <h3>
            <Link href={url}>{props.name}</Link>
          </h3>
          <ul>
            <li>{props.category}</li>
            <li>{props.manufacturers[0]} {manufacturerCount(props.manufacturers)}</li>
          </ul>
        </div>
        <aside>
          <Rarity.Group direction="vertical">
            {props.rarities.map(rarity => (
              <Rarity key={rarity} rarity={rarity} />
            ))}
          </Rarity.Group>
        </aside>
      </main>
      <Link href={url} className={Style.button}>
        View Details <HiChevronDoubleRight className={Style.icon} />
      </Link>
    </article>
  );
}

Card.Group = Group;

export { Card };