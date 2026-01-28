import { z } from "zod";

/**
 * Schema for an array representing a minimum value or a minimum and maximum value range.
 */
const minMaxArray = z.union([
  z.tuple([z.number()]),
  z.tuple([z.number(), z.number()]),
]);

/**
 * Schema for a weapon part with name and modifiers.
 */
const partSchema = z.object({
  name: z.string(),
  modifiers: z.array(z.string()),
});

/**
 * Schema for a item object with all its properties.
 */
export const Schema = z.object({
  content: z.enum([
    "Base Game",
    "The Zombie Island of Dr. Ned",
    "Mad Moxxi's Underdome Riot",
    "The Secret Armory of General Knoxx",
    "Claptrap's New Robot Revolution",
    "Enhanced",
  ]),
  dlc: z.boolean(),
  images: z.object({
    item: z.string(),
  }),
  resources: z.object({
    lootlemon: z.string().optional(),
    wiki: z.string(),
  }),
  name: z.string(),
  type: z.enum([
    "Repeater",
    "Revolver",
    "SMG",
    "Assualt rifle",
    "Shotgun",
    "Sniper",
    "Launcher",
    "Eridian",
  ]),
  description: z.string(),
  manufacturer: z.array(z.enum([
    "Atlas",
    "Dahl",
    "Eridian",
    "Hyperion",
    "Jakobs",
    "Maliwan",
    "S&S Munitions",
    "Tediore",
    "Torgue",
    "Vladof",
  ])),
  elements: z.array(z.enum([
    "Incendiary",
    "Corrosive",
    "Shock",
    "Explosive",
  ])).optional(),
  multiplier: minMaxArray.optional(),
  rarity: z.array(z.enum([
    "Common",
    "Uncommon",
    "Rare",
    "Epic",
    "Legendary",
    "Pearlescent",
  ])),
  special: z.object({
    red: z.string(),
    description: z.string(),
  }).optional(),
  ranges: z.object({
    damage: minMaxArray.optional(),
    accuracy: minMaxArray.optional(),
    rate: minMaxArray.optional(),
    mag: minMaxArray.optional(),
  }).optional(),
  parts: z.object({
    Body: z.array(partSchema).optional(),
    Barrel: z.array(partSchema).optional(),
    Magazine: z.array(partSchema).optional(),
    Stock: z.array(partSchema).optional(),
    Sight: z.array(partSchema).optional(),
    Accessory: z.array(partSchema).optional(),
    Material: z.array(partSchema).optional(),
  }),
  max: z.object({
    damage: z.number().min(1),
    accuracy: z.number().min(1),
    fire_rate: z.number().min(1),
    mag_size: z.number().min(1),
    level: z.number().min(1),
  }).optional(),
  source: z.array(z.object({
    name: z.string(),
    tags: z.array(z.string()),
  })).optional(),
});
