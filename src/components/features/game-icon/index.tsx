"use client";

import clsx from "clsx";

import { Config } from "#config";

import Style from "./style.module.css";

import type { Game } from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the GameIcon component.
 */
interface Props {
  game: Game;
  label?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a game icon with optional label styling.
 *
 * @param game - The game identifier used to fetch the corresponding logo and title.
 * @param label - Whether to apply label styling to the icon (default: `false`).
 * @param className - Optional CSS class name to apply to the icon element.
 * @param style - Optional inline styles to apply to the icon element.
 * @returns A React element displaying the game icon.
 */
export function GameIcon({ game, label = false, className, style }: Props) {
  const title = Config.Games.Title[game];

  return (
    <i
      className={clsx(Style.root, label && Style.labelled, className)}
      style={{ ...style, backgroundImage: `url('/img/logos/${game}.png')` }}
      title={title}
    >
      {title}
    </i>
  );
}