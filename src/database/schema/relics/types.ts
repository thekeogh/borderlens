import { z } from "zod";

import { Type } from "#database/schema/relics/type.schema";

export type Type = z.infer<typeof Type>;