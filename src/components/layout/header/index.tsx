"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";

import { Config } from "#config";

import Style from "./style.module.css";

import type { CSSProperties } from "react";

/**
 * Props for the Header component.
 */
interface Props {
  className?: string;
  style?: CSSProperties;
}

export function Header({ className, style }: Props) {
  return (
    <header className={clsx(Style.root, className)} style={style}><div className="container">
      <Link href="/" className={clsx(Style.logo, "link")}>
        <Image
          priority
          src="/img/logos/borderlens.png"
          width={1352}
          height={334}
          alt={Config.Meta.alt}
          title={Config.Meta.title}
        />
      </Link>
      <div className={Style.search}>
        SEARCHhkhkj
      </div>
      <nav>
        RIGHT
      </nav>
    </div></header>
  );
}
