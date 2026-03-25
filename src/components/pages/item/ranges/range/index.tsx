"use client";

import { Config } from "#config";

import { StatIcon } from "#components/features/stat-icon";

import Style from "./style.module.css";

import type { MinMaxArray } from "#database/schema/shared/types";
import type { Stat } from "#database/schema/types";

/**
 * Props for the Range component.
 */
interface Props {
  type: Stat;
  values: MinMaxArray;
}

/**
 * Renders a visual range card displaying a specific weapon attribute range.
 *
 * @remarks
 * This component displays a range type (accuracy, damage, magazine capacity, or fire rate) with an associated icon,
 * formatted title, and value(s). If the values array is empty or invalid, the component returns null. The component
 * uses type-specific unit formatting (e.g. "%" for accuracy, "/s" for rate).
 *
 * @param type - The range type identifier.
 * @param values - The minimum and maximum values for the range.
 * @returns The rendered range card element, or null if values are invalid.
 */
export function Range({ type, values }: Props) {
  if (!Array.isArray(values) || !values.length) {
    return null;
  }
  const title = Config.Games.Stats[type];

  /**
   * Generates a formatted string representation of the range values.
   *
   * @remarks
   * This function formats the range values with appropriate unit suffixes based on the range type. For accuracy, it
   * appends a percentage sign; for rate, it appends "/s" (per second). When multiple values exist, they are joined
   * with a dash to show the range.
   *
   * @returns The formatted range value string with type-specific units.
   */
  const getValue = (): string => {
    const op = type === "accuracy" ? "%" : type === "rate" ? "/s" : "";
    const suffix = values.length === 2 ? ` - ${values[1]}${op}` : "";
    return `${values[0]}${op}${suffix}`;
  };

  return (
    <div className={Style.root} title={`Possible ${title.toLowerCase()} ranges`}>
      <i className={Style.icon}>
        <StatIcon type={type} />
      </i>
      <p className={Style.name}>{title}</p>
      <p className={Style.value}>
        {getValue()}
      </p>
    </div>
  );
}