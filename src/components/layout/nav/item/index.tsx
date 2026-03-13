"use client";

import clsx from "clsx";
import Link from "next/link";

import { Config } from "#config";

import Style from "./style.module.css";

import type { Game } from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Item component.
 */
interface Props {
  game: Game;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a navigation item for the specified game.
 *
 * @param game - The game identifier for which the navigation item is rendered.
 * @param className - Optional additional CSS class names to apply to the item.
 * @param style - Optional inline styles for the navigation item.
 */
export function Item({ game, className, style }: Props) {
  const title = Config.Games.Title[game];
  const nav = Config.Games.Navigation[game];

  return (
    <div
      className={clsx(Style.root, className)}
      title={title}
      style={{ ...style, backgroundImage: `url("/img/logos/${game}.png")` }}
    >
      <div className={Style.dropdown}>
        <p role="presentation">{title}</p>
        <ul>
          {Object.entries(nav).map(([slug, label]) => (
            <li key={slug}><Link href="" className="link">{label}</Link></li>
          ))}
        </ul>
      </div>
      <span>{title}</span>
    </div>
  );
}
