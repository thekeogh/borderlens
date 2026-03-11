import type { Game } from "#database/schema/types";

export const Routes = {
  search: (query: string, games: Set<Game>) => `/search?q=${encodeURIComponent(query.trim())}&g=${Array.from(games).join(",")}`,
};

/*
Convert ?g back to a set:

const games = new Set(searchParams.get("g")?.split(",") ?? []);
*/