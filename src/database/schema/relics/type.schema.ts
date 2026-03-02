import { z } from "zod";

export const Type = z.enum([
  "Aggression",
  "Allegiance",
  "Elemental",
  "Offense",
  "Proficiency",
  "Protection",
  "Resistance",
  "Stockpile",
  "Strength",
  "Survivability",
  "Tenacity",
  "Unique",
  "Universal",
  "Vitality",
]);
