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

/**
 * Displays the drop zone section for an item, showing all confirmed sources where the item can be obtained.
 *
 * @param item - The item schema object containing source information.
 * @returns The rendered drop zone component, or `null` if no sources are available.
 */
export function DropZone({ item }: Props) {
  const sources = item.sources;
  if (!sources.length) {
    return null;
  }

  /**
   * Determines the CSS class to apply to a drop zone tag based on its content.
   *
   * @param tag - The tag string to evaluate.
   * @returns The CSS class name if the tag matches "drop rate", otherwise `undefined`.
   */
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