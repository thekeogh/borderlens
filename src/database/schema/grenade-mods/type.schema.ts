import { z } from "zod";

export const Type = z.enum([
  "Area of Effect",
  "Bouncing Betty",
  "Bouncing Bettie",
  "MIRV",
  "Singularity",
  "Standard",
  "Transfusion",
  "Unique",
]);
