import { notFound } from "next/navigation";

import { playgroundComponents } from "../../playground/generated/metadata";
import { PlaygroundClient } from "./playground-client";

export default function PlaygroundPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <PlaygroundClient components={playgroundComponents} />;
}
