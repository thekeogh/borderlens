import { z } from "zod";

import { Type } from "#database/schema/shields/type.schema";

export type Type = z.infer<typeof Type>;