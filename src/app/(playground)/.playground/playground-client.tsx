"use client";

import dynamic from "next/dynamic";

import type { PlaygroundComponentMeta } from "../../../playground/types";

const PlaygroundShell = dynamic(
  () => import("./playground-shell").then(module => module.PlaygroundShell),
  {
    ssr: false,
  }
);

interface PlaygroundClientProps {
  components: PlaygroundComponentMeta[];
}

export function PlaygroundClient({ components }: PlaygroundClientProps) {
  return <PlaygroundShell components={components} />;
}
