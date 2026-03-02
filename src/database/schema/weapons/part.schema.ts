import { z } from "zod";

const PartSchema = z.object({
  name: z.string(),
  modifiers: z.array(z.string()),
}).strict();

export const Part = z.object({
  Body: z.array(PartSchema).optional(),
  Barrel: z.array(PartSchema).optional(),
  Magazine: z.array(PartSchema).optional(),
  Grip: z.array(PartSchema).optional(),
  Stock: z.array(PartSchema).optional(),
  Sight: z.array(PartSchema).optional(),
  Accessory: z.array(PartSchema).optional(),
  Exhaust: z.array(PartSchema).optional(),
  Element: z.array(PartSchema).optional(),
  Material: z.array(PartSchema).optional(),
}).strict();
