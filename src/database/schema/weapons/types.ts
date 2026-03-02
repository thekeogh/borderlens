import { z } from "zod";

import { Part } from "#database/schema/weapons/part.schema";
import { Range } from "#database/schema/weapons/range.schema";
import { Type } from "#database/schema/weapons/type.schema";

export type Part = z.infer<typeof Part>;
export type Range = z.infer<typeof Range>;
export type Type = z.infer<typeof Type>;