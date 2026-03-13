import { catalog } from "#database/catalog";

import { Hero } from "#components/pages/home/hero";
import { Showcase } from "#components/pages/home/showcase";

export default function Home() {
  const showcase = catalog.listShowcase();

  return (
    <>
      <Hero />
      <Showcase items={showcase} />
    </>
  );
}
