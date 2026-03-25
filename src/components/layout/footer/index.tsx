"use client";

import Style from "./style.module.css";

export function Footer() {
  return (
    <footer className={Style.root}>
      <div className="container">
        <p><span>&copy;</span> {new Date().getFullYear()} Borderlens // Not affiliated with Gearbox or 2K</p>
        <p>Artwork <span>&copy;</span> Borderlens. No reuse without permission. Borderlands and related IP belong to Gearbox Software and 2K.</p>
      </div>
    </footer>
  );
}