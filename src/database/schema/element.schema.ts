import { z } from "zod";

export const Element = z.enum([
  "None",
  "Incendiary",
  "Corrosive",
  "Shock",
  "Explosive",
  "Slag",
]);
