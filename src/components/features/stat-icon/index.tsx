"use client";

import { BsCrosshair } from "react-icons/bs";
import { GiMachineGunMagazine, GiAmmoBox, GiSpeedometer, GiBullseye } from "react-icons/gi";

import type { Stat } from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the StatIcon component.
 */
interface Props {
  type: Stat;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a stat icon corresponding to the specified range type.
 *
 * @param type - The range type that determines which icon is rendered.
 * @param className - Optional CSS class name to apply to the icon element.
 * @param style - Optional inline styles to apply to the icon element.
 * @returns A React icon element representing the specified stat type.
 */
export function StatIcon({ type, className, style }: Props) {
  switch(type) {
    case "accuracy":
      return <GiBullseye className={className} style={style} />;
    case "damage":
      return <BsCrosshair className={className} style={style} />;
    case "mag":
      return <GiMachineGunMagazine className={className} style={style} />;
    case "rate":
      return <GiSpeedometer className={className} style={style} />;
    default:
      return <GiAmmoBox className={className} style={style} />;
  }
}