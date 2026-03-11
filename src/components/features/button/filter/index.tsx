"use client";

import clsx from "clsx";

import { Config } from "#config";

import Style from "./style.module.css";

import type { Game } from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Filter component.
 */
interface Props {
  game: Game;
  selected?: boolean;
  onClick: (value: Game) => void;
  className?: string;
  style?: CSSProperties;
}

export function Filter({ game, selected = false, onClick, className, style }: Props) {
  const title = Config.Games.Title[game];
  return (
    <button
      type="button"
      className={clsx(Style.root, selected && Style.selected, className)}
      style={{ ...style, backgroundImage: `url("/img/logos/${game}.png")` }}
      title={title}
      onClick={() => onClick(game)}
      aria-pressed={selected}
    >
      {title}
    </button>
  );
}