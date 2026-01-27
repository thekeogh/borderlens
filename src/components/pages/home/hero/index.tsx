"use client";

import clsx from "clsx";
import Image from "next/image";

import { Config } from "#config";

import Style from "./style.module.css";

import type { ReactElement } from "react";

/**
 * Props for the Hero component.
 */
interface Props {
  className?: string;
}

/**
 * Renders the hero section component.
 *
 * @param className - Additional CSS class names to apply to the hero section
 * @returns The rendered hero section element
 */
export function Hero({ className }: Props): ReactElement {
  return (
    <div className={clsx(Style.root, className)}>
      <div className={Style.flare} />

      {/* Logo */}
      <h1>
        <Image
          priority
          src="/img/branding/logo.png"
          width={1372}
          height={812}
          alt={Config.Meta.alt}
          title={Config.Meta.title}
          className={Style.logo}
        />
      </h1>

      {/* Tagline */}
      <p className={Style.tagline}>
        Borderlands Weapon Database
      </p>
    </div>
  );
}