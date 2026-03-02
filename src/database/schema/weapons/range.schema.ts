import { z } from "zod";

import { MinMaxArray } from "#database/schema/shared/min-max-array.schema";

export const Range = z.object({
  damage: MinMaxArray.optional(),
  accuracy: MinMaxArray.optional(),
  rate: MinMaxArray.optional(),
  mag: MinMaxArray.optional(),
}).strict();
