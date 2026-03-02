import Fuse from "fuse.js";
import { notFound } from "next/navigation";

import { SHOWCASE as BL_SHOWCASE } from "#database/borderlands/constants/showcase.constants";
import { SHOWCASE as BL2_SHOWCASE } from "#database/borderlands2/constants/showcase.constants";
import database from "#database/database.json";

import type { Category, Game, Schema } from "#database/schema/types";

/**
 * Provides a mapping of game identifiers to their respective showcase item slugs.
 */
const SHOWCASE: Record<Game, string[]> = {
  borderlands: BL_SHOWCASE,
  borderlands2: BL2_SHOWCASE,
};

/**
 * Represents a catalogue for managing and querying game items.
 */
class Catalog {
  readonly #database: Schema[];
  readonly #fuse: Fuse<Schema>;
  readonly #games: Set<Game>;
  readonly #categories: Set<Category>;


  /**
   * Initialises a new instance of the {@link Catalog} class.
   *
   * @remarks
   * This constructor sets up the internal catalogue database, configures the Fuse.js fuzzy search index with predefined
   * keys and weights, and initialises empty game and category filters for further querying.
   */
  public constructor() {
    this.#database = database as Schema[];
    this.#fuse = new Fuse(this.#database, {
      keys: [
        { name: "name", weight: 0.8 },
        { name: "aliases", weight: 0.7 },
        { name: "special.red", weight: 0.5 },
        { name: "manufacturer", weight: 0.3 },
        { name: "rarity", weight: 0.3 },
        { name: "type", weight: 0.3 },
        { name: "category", weight: 0.2 },
        { name: "abilities", weight: 0.1 },
        { name: "elements", weight: 0.1 },
        { name: "skills", weight: 0.1 },
        { name: "sources", weight: 0.1 },
      ],
      threshold: 0.2,
      ignoreLocation: true,
      includeScore: true,
      includeMatches: true,
    });
    this.#games = new Set();
    this.#categories = new Set();
  }

  /*
  |--------------------------------------------------------------------------------------------------------------------
  | Core Item Methods
  |--------------------------------------------------------------------------------------------------------------------
  |
  | Core methods for retrieving items from the catalogue. These methods support optional category filtering and return
  | items directly or as search results. All methods reset active category filters after execution.
  |
  |--------------------------------------------------------------------------------------------------------------------
  */

  /**
   * Retrieves a single catalogue item by its slug, filtered by the currently active game and category.
   *
   * @remarks
   * Both an active game and an active category filter must be set before calling this method. After execution, all
   * filters are reset.
   *
   * @param slug - The unique slug identifier of the item to retrieve.
   * @returns The found catalogue item, or a "not found" result if no matching item exists.
   * @throws {@link Error} If no game or category is set, or if multiple games or categories are active.
   */
  public get(slug: string): Schema {
    this.throwOnEmptyGames();
    this.throwOnMultipleGames();
    this.throwOnEmptyCategories();
    this.throwOnMultipleCategories();
    const game = [...this.#games][0];
    const category = [...this.#categories][0];
    this.reset();
    const item = this.#database.find(record => (record.game === game && record.category === category && record.slug === slug));
    if (!item) {
      return notFound();
    }
    return item;
  }

  /**
   * Retrieves all catalogue items filtered by the active games and, if set, categories.
   *
   * @remarks
   * If categories are not specified, items from all categories within the active games are included. The active filters
   * are reset after execution.
   *
   * @returns An array of catalogue items matching the current filters.
   * @throws {@link Error} If no active games are specified.
   */
  public list(): Schema[] {
    this.throwOnEmptyGames();
    const results = this.#database.filter(item => {
      const gameMatch = this.#games.has(item.game);
      const categoryMatch = !this.#categories.size || this.#categories.has(item.category);
      return gameMatch && categoryMatch;
    });
    this.reset();
    return results;
  }

  /**
   * Searches the catalogue for items matching the specified query, optionally filtered by active games and categories.
   *
   * @param query - The search query string to match items against.
   * @param limit - The maximum number of results to return. Defaults to 60.
   * @returns An array of matching catalogue items.
   * @throws {@link Error} If a search query is not provided.
   */
  public search(query: string, limit = 60): Schema[] {
    if (!query) {
      throw new Error("A search query is required.");
    }
    const results = this.#fuse.search(query, { limit: 1000 });
    const filtered = results.filter(({ item }) => {
      const gameMatch = !this.#games.size || this.#games.has(item.game);
      const categoryMatch = !this.#categories.size || this.#categories.has(item.category);
      return gameMatch && categoryMatch;
    });
    this.reset();
    return filtered.slice(0, limit).map(r => r.item);
  }

  /**
   * Retrieves a list of showcase items from the database filtered by the active games.
   *
   * @remarks
   * This method returns showcase items limited to the "weapons" category. If no active games are specified, all
   * available showcase items are included. Only items whose slugs appear in the showcase configuration for the relevant
   * games are returned.
   *
   * @returns An array of showcase items from the database.
   */
  public listShowcase(): Schema[] {
    const slugs = (Object.entries(SHOWCASE) as [Game, string[]][])
      .filter(([game]) => !this.#games.size || this.#games.has(game))
      .flatMap(([, gameSlugs]) => gameSlugs);
    this.reset();
    if (!slugs.length) {
      return [];
    }
    return this.#database.filter(item =>
      item.category === "weapons" && slugs.includes(item.slug)
    );
  }

  /*
  |--------------------------------------------------------------------------------------------------------------------
  | Chaining Methods
  |--------------------------------------------------------------------------------------------------------------------
  |
  | These methods enable query filtering by category through a fluent interface. Each method adds a category filter
  | and returns the instance for method chaining, allowing callers to compose queries before executing operations
  | like get().
  |
  |--------------------------------------------------------------------------------------------------------------------
  */

  /**
   * Filters results to include only items from Borderlands.
   *
   * @returns This catalog instance for method chaining.
   */
  public borderlands(): this {
    this.#games.add("borderlands");
    return this;
  }

  /**
   * Filters results to include only items from Borderlands 2.
   *
   * @returns This catalog instance for method chaining.
   */
  public borderlands2(): this {
    this.#games.add("borderlands2");
    return this;
  }

  /**
   * Filters results to include only weapons.
   *
   * @returns This catalog instance for method chaining.
   */
  public weapons(): this {
    this.#categories.add("weapons");
    return this;
  }

  /**
   * Filters results to include only shields.
   *
   * @returns This catalog instance for method chaining.
   */
  public shields(): this {
    this.#categories.add("shields");
    return this;
  }

  /**
   * Filters results to include only grenade mods.
   *
   * @returns This catalog instance for method chaining.
   */
  public grenadeMods(): this {
    this.#categories.add("grenade-mods");
    return this;
  }

  /**
   * Filters results to include only class mods.
   *
   * @returns This catalog instance for method chaining.
   */
  public classMods(): this {
    this.#categories.add("class-mods");
    return this;
  }

  /**
   * Filters results to include only relics.
   *
   * @returns This catalog instance for method chaining.
   */
  public relics(): this {
    this.#categories.add("relics");
    return this;
  }

  /**
   * Filters catalog to specified games.
   *
   * @param games - One or more game identifiers to filter by.
   * @returns This catalog instance for method chaining.
   *
   * @example
   * ```typescript
   * // Single game from URL params
   * catalog.games(params.game).get(params.slug);
   *
   * // Multiple games
   * catalog.games("borderlands", "borderlands2").search("fire");
   * ```
   */
  public games(...games: Game[]): this {
    games.forEach(game => this.#games.add(game));
    return this;
  }

  /**
   * Filters catalog to specified categories.
   *
   * @param categories - One or more category identifiers to filter by.
   * @returns This catalog instance for method chaining.
   *
   * @example
   * ```typescript
   * // Single category from URL params
   * catalog.categories(params.category).get(params.slug);
   *
   * // Multiple categories
   * catalog.categories("weapons", "class-mods").search("fire");
   * ```
   */
  public categories(...categories: Category[]): this {
    categories.forEach(cat => this.#categories.add(cat));
    return this;
  }

  /*
  |--------------------------------------------------------------------------------------------------------------------
  | Private Methods
  |--------------------------------------------------------------------------------------------------------------------
  |
  | These methods provide internal functionality and are not intended for external use. They support implementation
  | details and may be modified or removed in future versions without notice. Consumers should rely only on the public
  | interface defined by the documented public methods.
  |
  |--------------------------------------------------------------------------------------------------------------------
  */


  /**
   * Throws an error if no games are currently selected.
   *
   * @remarks
   * This method enforces that at least one game is selected before continuing. It is used internally to validate query
   * composition and prevent operations without a game context.
   *
   * @throws {@link Error} When no game has been selected.
   */
  private throwOnEmptyGames(): void {
    if (this.#games.size === 0) {
      throw new Error("A game is required. Please use borderlands(), borderlands2(), or similar methods.");
    }
  }

  /**
   * Throws an error if more games than allowed are selected.
   *
   * @param n - The maximum number of allowed games.
   * @throws {@link Error} When the selected game count exceeds the given limit.
   */
  private throwOnMultipleGames(n = 1): void {
    if (this.#games.size > n) {
      throw new Error(`Exactly one game is required; received: ${[...this.#games].join(", ")}`);
    }
  }

  /**
   * Throws an error if no categories are currently selected.
   *
   * @remarks
   * Used internally to ensure that an operation is being performed with a category context.
   *
   * @throws {@link Error} When no category has been selected.
   */
  private throwOnEmptyCategories(): void {
    if (this.#categories.size === 0) {
      throw new Error("A category is required. Please use weapons(), shields(), or similar methods.");
    }
  }

  /**
   * Throws an error if more categories than allowed are selected.
   *
   * @param n - The maximum number of allowed categories.
   * @throws {@link Error} When the selected category count exceeds the given limit.
   */
  private throwOnMultipleCategories(n = 1): void {
    if (this.#categories.size > n) {
      throw new Error(`Exactly one category is required; received: ${[...this.#categories].join(", ")}`);
    }
  }

  /**
   * Clears all selected categories from the instance.
   */
  private resetCategories(): void {
    this.#categories.clear();
  }

  /**
   * Clears all selected games from the instance.
   */
  private resetGames(): void {
    this.#games.clear();
  }


  /**
   * Resets the instance by clearing all selected categories and games.
   */
  private reset(): void {
    this.resetCategories();
    this.resetGames();
  }

}

export const catalog = new Catalog();