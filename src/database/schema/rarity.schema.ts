import { z } from "zod";

export const Rarity = z.enum([
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "E-tech",
  "Legendary",
  "Effervescent",
  "Seraph",
  "Pearlescent",
]);
