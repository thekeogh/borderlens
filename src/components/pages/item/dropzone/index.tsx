"use client";

import { GiDeathZone } from "react-icons/gi";

import Style from "./style.module.css";

import type { Schema } from "#database/schema/types";

/**
 * Props for the DropZone component.
 */
interface Props {
  item: Schema;
}

export function DropZone({ item }: Props) {
  const sources = item.sources;

  if (!sources.length) {
    return null;
  }

  const styleTag = (tag: string): string | undefined => {
    if (tag.toLowerCase().includes("drop rate")) {
      return Style.rate;
    }
  };

  return (
    <section className={Style.root}>
      <header>
        <i>
          <GiDeathZone />
        </i>
        <h2>
          Drop Zone
          <small>{sources.length} confirmed source{sources.length !== 1 ? "s" : ""}</small>
        </h2>
      </header>
      <main>
        {sources.map(source => (
          <article key={source.name}>
            <p>{source.name}</p>
            <ul className={source.name.toLowerCase().includes("pool") ? Style.pool : undefined}>
              {source.tags.map(tag => (
                <li key={tag} className={styleTag(tag)}>{tag}</li>
              ))}
            </ul>
          </article>
        ))}
      </main>
    </section>
  );
}