"use client";

import clsx from "clsx";
import Link from "next/link";

import Style from "./style.module.css";

import type { CSSProperties } from "react";

/**
 * Props for the Image component.
 */
interface Props {
  src: string;
  alt: string;
  href?: string;
  className?: string;
  style?: CSSProperties;
}

export function Image({ src, alt, href, className, style }: Props) {
  const img = (
    <div className={clsx(Style.root, href && Style.linked, className)} style={style}>
      <div
        className={Style.img}
        style={{ backgroundImage: `url(${src})` }}
        role="img"
        aria-label={alt}
        title={alt}
      />
    </div>
  );
  if (href) {
    return <Link href={href} className={Style.link}>{img}</Link>;
  } else {
    return img;
  }
}