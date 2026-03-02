import { z } from "zod";

export const Class = z.enum([
  "Assassin",
  "Berserker",
  "Commando",
  "Gunzerker",
  "Hunter",
  "Mechromancer",
  "Psycho",
  "Siren",
  "Soldier",
]);
