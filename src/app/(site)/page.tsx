import { catalog } from "#database/catalog";

import { Hero } from "#components/pages/home/hero";
import { Showcase } from "#components/pages/home/showcase";

/**
 * Disables automatic revalidation for this route, ensuring static content is served without regeneration.
 *
 * @remarks
 * This setting is specifically for the showcase feature, which displays randomised results on each page refresh. By
 * preventing revalidation, the page remains static and relies on client-side rendering to generate different showcase
 * selections.
 */
export const revalidate = 0;

/**
 * Renders the home page with the main hero section and a showcase of featured items.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Showcase items={catalog.listShowcase()} />
    </>
  );
}
