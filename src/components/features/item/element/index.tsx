"use client";

import clsx from "clsx";
import { FaFireAlt } from "react-icons/fa";
import { FaBan } from "react-icons/fa"; // none
import { FaBoltLightning } from "react-icons/fa6";
import { FaBiohazard } from "react-icons/fa6";
import { FaExplosion } from "react-icons/fa6";
import { GiStaticWaves } from "react-icons/gi"; // slag

import { Group } from "#components/features/item/element/group";

import Style from "./style.module.css";

import type * as Types from "#database/schema/types";
import type { CSSProperties } from "react";

/**
 * Props for the Element component.
 */
interface Props {
  element: Types.Element;
  size?: "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

function Element({ element, size = "md", className, style }: Props) {

  const icon = () => {
    switch (element) {
      case "Corrosive":
        return <FaBiohazard />;
        break;
      case "Explosive":
        return <FaExplosion />;
        break;
      case "Incendiary":
        return <FaFireAlt />;
        break;
      case "Shock":
        return <FaBoltLightning />;
        break;
      case "Slag":
        return <GiStaticWaves />;
        break;
      default:
        return <FaBan />;
    }
  };

  return (
    <i
      className={clsx(Style.root, Style[size], className)}
      style={{ ...style, "--color-element": `var(--color-element-${element.toLowerCase()})` } as React.CSSProperties}
      title={element}
    >
      {icon()}
    </i>
  );
}

Element.Group = Group;

export { Element };