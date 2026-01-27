"use client";

import clsx from "clsx";
import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Style from "./style.module.css";

import type { ReactElement, SubmitEvent } from "react";

/**
 * Props for the Search component.
 */
interface Props {
  className?: string;
}

/**
 * Search input that navigates to the weapon list with a query.
 *
 * @param className - Optional extra CSS classes.
 * @returns The search form element.
 */
export function Search({ className }: Props): ReactElement {
  const [query, setQuery] = useState("");
  const router = useRouter();

  /**
   * Handles form submission.
   *
   * @param e - The submit event.
   */
  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/weapons?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form className={clsx(Style.root, className)} onSubmit={onSubmit}>
      <SearchIcon className={Style.magnify} />
      <input
        className={Style.control}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search weapons..."
      />
    </form>
  );
}