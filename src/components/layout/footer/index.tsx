"use client";

import { FaGithub } from "react-icons/fa";

import Style from "./style.module.css";

/**
 * Renders the application footer with copyright and attribution information.
 */
export function Footer() {
  return (
    <footer className={Style.root}>
      <div className="container">
        <div className={Style.left}>
          <p><span>&copy;</span> {new Date().getFullYear()} Borderlens // Not affiliated with Gearbox or 2K</p>
          <p>Artwork <span>&copy;</span> Borderlens. No reuse without permission. Borderlands and related IP belong to Gearbox Software and 2K.</p>
        </div>
        <div className={Style.right}>
          <a href="https://github.com/thekeogh/borderlens" target="_blank" title="Go to GitHub repo">
            <FaGithub color="#71717a" size={30} />
          </a>
        </div>
      </div>
    </footer>
  );
}