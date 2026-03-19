import { notFound } from "next/navigation";

import { catalog } from "#database/catalog";

import { Header } from "#components/pages/item/header";

import type { Game, Category } from "#database/schema/types";

/**
 * Props for the item page route.
 */
interface Props {
  params: Promise<{ game: Game; category: Category; slug: string }>
}

/**
 * Resolves the current route parameters and renders the corresponding item.
 */
export default async function Item({ params }: Props) {
  const { game, category, slug } = await params;
  const item = catalog.games(game).categories(category).get(slug);

  /**
   * Renders a 404 page when the requested item cannot be found in the catalogue.
   */
  if (!item) {
    return notFound();
  }

  return (
    <div className="container pad-xl">
      <Header item={item} />
    </div>
  );
}
