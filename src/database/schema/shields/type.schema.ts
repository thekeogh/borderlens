import { z } from "zod";

export const Type = z.enum([
  "Absorb",
  "Adaptive",
  "Amplify",
  "Booster",
  "Heal",
  "Nova",
  "Reflect",
  "Resistance",
  "Roid",
  "Spike",
  "Standard",
  "Turtle",
]);
