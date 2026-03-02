import { z } from "zod";

export const Special = z.object({
  title: z.string().optional(),
  description: z.string(),
}).strict();