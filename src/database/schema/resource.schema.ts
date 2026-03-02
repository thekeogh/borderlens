import { z } from "zod";

export const Resource = z.object({
  lootlemon: z.string().optional(),
  wiki: z.string().optional(),
}).strict().refine(
  (value) => Boolean(value.lootlemon || value.wiki),
  { message: "resources must include at least one of lootlemon or wiki" }
);
