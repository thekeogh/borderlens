"use client";

import clsx from "clsx";
import { useState } from "react";
import { TbFileDescriptionFilled, TbFilePencilFilled } from "react-icons/tb";

import { toSnakeCase, formatLineBreaks } from "#utils/string";

import Style from "./style.module.css";

import type { Schema } from "#database/schema/types";

/**
 * Props for the Dossier component.
 */
interface Props {
  item: Schema;
}

/**
 * Renders a classified dossier display for an item with tabbed content sections.
 *
 * @param item - The item data to display in the dossier.
 */
export function Dossier({ item }: Props) {
  const [content, setContent] = useState<"description" | "notes">("description");
  const hasNotes = !!item.notes;
  const manufacturer = toSnakeCase(item.manufacturers[0]);

  return (
    <section className={Style.root}>
      <div className={Style.titlebar}>
        <span className={Style.blip} /><span className={Style.blip} /><span className={Style.blip} />
        {manufacturer}_CORP
        <span>:: CLASSIFIED_DATA</span>
        :: {toSnakeCase(item.name)}__{toSnakeCase(item.type)}
      </div>
      <div className={clsx(Style.dossier, Style[content])}>
        <ul className={Style.tabs}>
          <li onClick={() => setContent("description")}><TbFileDescriptionFilled size={14} /> Description.txt</li>
          {hasNotes && <li onClick={() => setContent("notes")}><TbFilePencilFilled size={14} /> Notes.txt</li>}
        </ul>
        <div className={Style.content}>
          {/* Description */}
          <div>
            <p>root@{manufacturer}-db:~$ <span>cat description.txt</span></p>
            {formatLineBreaks(item.description)}
            <span className={Style.cursor} />
          </div>
          {/* Notes */}
          {hasNotes && (
            <div>
              <p>root@hyperion-db:~$ <span>cat notes.txt</span></p>
              {formatLineBreaks(item.notes as string)}
              <span className={Style.cursor} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}