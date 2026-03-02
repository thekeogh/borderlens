import { z } from "zod";

export const MinMaxArray = z.union([
  z.tuple([z.number()]),
  z.tuple([z.number(), z.number()]),
]);
