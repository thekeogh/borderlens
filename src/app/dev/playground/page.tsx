import { notFound } from "next/navigation";

import { playgroundComponents } from "../../../playground/generated/metadata";
import { PlaygroundShell } from "./playground-shell";

export default function PlaygroundPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <PlaygroundShell components={playgroundComponents} />;
}
