"use client";

import clsx from "clsx";
import Image from "next/image";
import { Suspense } from "react";

import { Config } from "#config";

import { Search } from "#components/features/search";

import Style from "./style.module.css";

import type { CSSProperties } from "react";

/**
 * Props for the Hero component.
 */
interface Props {
  className?: string;
  style?: CSSProperties;
}

export function Hero({ className, style }: Props) {
  return (
    <section className={clsx(Style.root, className)} style={style}>
      <div className={Style.background} aria-hidden="true" />
      <div className={Style.flares} aria-hidden="true">
        <div /><div /><div />
      </div>
      <div className="container sm">
        <h1>
          <Image
            priority
            src="/img/logos/logo.png"
            width={1372}
            height={812}
            alt={Config.Meta.alt}
            title={Config.Meta.title}
          />
        </h1>
        <p className={Style.tagline}>Borderlands Weapon Database</p>
        <Suspense fallback={null}>
          <Search size="md" theme="light" />
        </Suspense>
      </div>
    </section>
  );
}