import { z } from "zod";

export const Category = z.enum([
  "class-mods",
  "grenade-mods",
  "relics",
  "shields",
  "weapons",
]);
