"use client";

import { Footer } from "#components/layout/footer";
import { Header } from "#components/layout/header";
import { ScrollToTop } from "#components/ui/scroll-to-top";

import Style from "./style.module.css";

import type { ReactNode } from "react";

/**
 * Props for the Template component.
 */
interface Props {
  children: ReactNode;
}

/**
 * Renders the application background with visual effects and wraps the main content area.
 *
 * @param children - The content to be displayed within the background.
 */
export function Template({ children }: Props) {
  return (
    <>
      <ScrollToTop />
      <Header />
      <div className={Style.root}>
        <div className={Style.scanlines} aria-hidden="true" />
        <div className={Style.noise} aria-hidden="true" />
        <main>
          {children}
        </main>
      </div>
      <Footer />
    </>
  );
}