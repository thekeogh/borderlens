import { z } from "zod";

export const Rarity = z.enum([
  "Common",
  "Uncommon",
  "Rare",
  "Cursed",
  "Epic",
  "Gemstone",
  "E-tech",
  "Legendary",
  "Effervescent",
  "Seraph",
  "Pearlescent",
]);
