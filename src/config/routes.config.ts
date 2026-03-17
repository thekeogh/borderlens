import type { Game, Category } from "#database/schema/types";

/**
 * Provides route-generating functions for key application paths.
 */
export const Routes = {
  search: (query: string, games: Set<Game>) => `/search?q=${encodeURIComponent(query.trim())}&g=${Array.from(games).join(",")}`,
  category: (game: Game, category: Category) => `/${game}/${category}`,
  item: (game: Game, category: Category, slug: string) => `/${game}/${category}/${slug}`,
};
