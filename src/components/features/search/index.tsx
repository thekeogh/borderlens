"use client";

import clsx from "clsx";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";

import { Config } from "#config";

import { Button } from "#components/features/button";

import Style from "./style.module.css";

import type { Game } from "#database/schema/types";
import type { CSSProperties, SubmitEvent } from "react";

/**
 * Props for the Search component.
 */
interface Props {
  header?: boolean;
  size: "sm" | "md";
  theme: "light" | "dark";
  value?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a filter button for a specific game and manages its selected state.
 *
 * @param game - The game represented by this filter button.
 * @param games - The set of currently selected games.
 * @param onClick - Callback invoked when the filter button is clicked.
 */
function Filter({ game, games, onClick }: { game: Game; games: Set<Game>; onClick: (game: Game) => void }) {
  return <Button.Filter selected={games.has(game)} onClick={onClick} game={game} />;
}

/**
 * Renders the search input component with configurable size, theme, optional initial value, and header context.
 *
 * @param header - If true, adapts the component for use within a header.
 * @param size - The visual size variant of the component.
 * @param theme - The colour theme to apply to the component.
 * @param value - Optional initial search value.
 * @param className - Optional additional class names to apply.
 * @param style - Optional inline styles to apply to the component.
 */
export function Search({ header, size, theme, value = "", className, style }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(value || urlQuery);
  const [games, setGames] = useState<Set<Game>>(new Set());

  /**
   * Updates the search query state when the URL query parameter changes.
   */
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  /**
   * Prevents rendering the search component in the header on the home page.
   *
   * @remarks
   * If the current path is the root ("/") and the header prop is true, the component returns null to avoid displaying
   * a duplicate or unnecessary search input in the header section of the home page.
   */
  if (pathname === "/" && header) {
    return null;
  }

  /**
   * Handles the form submission event for the search component.
   *
   * @param e - The form submission event.
   */
  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(Config.Routes.search(query, games));
    }
  };

  /**
   * Toggles the selection state of the specified game in the filter set.
   *
   * @param game - The game to add or remove from the filter selection.
   */
  function onFilterClick(game: Game) {
    setGames((prev) => {
      const next = new Set(prev);
      if (next.has(game)) {
        next.delete(game);
      } else {
        next.add(game);
      }
      return next;
    });
  }

  return (
    <form className={clsx("search", Style.root, Style[size], Style[theme], className)} style={style} onSubmit={onSubmit}>
      {!header && (
        <aside>
          <p>Filter by game <small>(optional - leave empty to search all)</small></p>
          <div className={Style.buttons}>
            <Filter game="borderlands" games={games} onClick={onFilterClick} />
            <Filter game="borderlands2" games={games} onClick={onFilterClick} />
          </div>
        </aside>
      )}
      <div className={Style.field}>
        <FaMagnifyingGlass className={Style.icon} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={Style.control}
          placeholder="Search items..."
        />
      </div>
    </form>
  );
}