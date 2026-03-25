import { z } from "zod";

import { Schema } from "#database/schema";
import { Category } from "#database/schema/category.schema";
import { Class } from "#database/schema/class.schema";
import { Content } from "#database/schema/content.schema";
import { Element } from "#database/schema/element.schema";
import { Game } from "#database/schema/game.schema";
import { Manufacturer } from "#database/schema/manufacturer.schema";
import { Max } from "#database/schema/max.schema";
import { Rarity } from "#database/schema/rarity.schema";
import { Resource } from "#database/schema/resource.schema";
import { Range } from "#database/schema/weapons/range.schema";

export type Category = z.infer<typeof Category>;
export type Class = z.infer<typeof Class>;
export type Content = z.infer<typeof Content>;
export type Element = z.infer<typeof Element>;
export type Game = z.infer<typeof Game>;
export type Manufacturer = z.infer<typeof Manufacturer>;
export type Max = z.infer<typeof Max>;
export type Rarity = z.infer<typeof Rarity>;
export type Resource = z.infer<typeof Resource>;
export type Stat = keyof z.infer<typeof Range>;
export type Schema = z.infer<typeof Schema>;