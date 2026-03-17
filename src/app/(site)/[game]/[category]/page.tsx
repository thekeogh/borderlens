import { notFound } from "next/navigation";

import { Config } from "#config";

import { catalog } from "#database/catalog";

import { Items } from "#components/pages/items";

import type { Game, Category } from "#database/schema/types";

/**
 * Props for the Category page component.
 */
interface Props {
  params: Promise<{ game: Game; category: Category }>
}

/**
 * Renders the category page for a specific game and category.
 *
 * @param params - A promise resolving to the current game and category parameters.
 */
export default async function Category({ params }: Props) {
  const { game, category } = await params;
  const gameTitle = Config.Games.Title[game];
  const categoryTitle = Config.Games.Navigation[game][category];
  const items = catalog.games(game).categories(category).list();

  /**
   * Handles scenarios where no items are found for the given game and category.
   *
   * @remarks
   * While results are typically expected for all valid category listings, there are cases where none will be returned.
   * For instance, if a user accesses a listing page for a category unsupported by the selected game (such as
   * 'borderlands' with the 'relics' category), this check will correctly trigger a not found response.
   */
  if (!items.length) {
    return notFound();
  }

  return <Items items={items} title={<>{gameTitle} <span>{categoryTitle}</span></>} />;
}
