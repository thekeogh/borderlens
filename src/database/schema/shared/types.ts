import { z } from "zod";

import { MinMaxArray } from "#database/schema/shared/min-max-array.schema";

export type MinMaxArray = z.infer<typeof MinMaxArray>;