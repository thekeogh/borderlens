import { z } from "zod";

export const Source = z.object({
  name: z.string(),
  tags: z.array(z.string()),
}).strict();
