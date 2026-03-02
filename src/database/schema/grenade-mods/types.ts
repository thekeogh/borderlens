import { z } from "zod";

import { Type } from "#database/schema/grenade-mods/type.schema";

export type Type = z.infer<typeof Type>;