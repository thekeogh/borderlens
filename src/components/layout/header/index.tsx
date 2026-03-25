"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { Config } from "#config";

import { Search } from "#components/features/search";
import { Nav } from "#components/layout/nav";

import Style from "./style.module.css";

/**
 * Renders the application header with branding, search, and navigation components.
 */
export function Header() {
  return (
    <header className={Style.root}><div className="container">
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
        <Suspense fallback={null}>
          <Search header size="sm" theme="dark" />
        </Suspense>
      </div>
      <Nav>
        <Nav.Item game="borderlands" />
        <Nav.Item game="borderlands2" />
      </Nav>
    </div></header>
  );
}
