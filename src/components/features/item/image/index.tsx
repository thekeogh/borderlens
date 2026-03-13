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

/**
 * Renders an item image, optionally wrapped in a link.
 *
 * @param src - The source URL of the image.
 * @param alt - The alternative text describing the image for accessibility.
 * @param href - The optional link destination. If provided, the image will be clickable.
 * @param className - Optional additional class name(s) for custom styling.
 * @param style - Optional inline CSS properties to apply to the component.
 */
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