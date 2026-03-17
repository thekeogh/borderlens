import { catalog } from "#database/catalog";

import { Items } from "#components/pages/items";

import type { Game } from "#database/schema/types";

/**
 * Represents the props for the Search page component.
 */
interface Props {
  searchParams: Promise<{ q: string; g?: string }>
}

/**
 * Renders the search page, handling query and game parameters from the URL.
 *
 * @param searchParams - A promise resolving to the current search query and game selection parameters.
 */
export default async function Search({ searchParams }: Props) {
  const query = (await searchParams).q;
  const games = new Set((await searchParams).g?.split(",") ?? []) as Set<Game>;
  const items = catalog.games(...games).search(query);

  return <Items items={items} title={<>Borderlands <span>Catalog</span></>} />;
}
