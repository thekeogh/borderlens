import { z } from "zod";

export const Max = z.object({
  level: z.number().min(1).optional(),
  damage: z.number().min(1).optional(),
  accuracy: z.number().min(0).optional(),
  rate: z.number().min(0).optional(),
  reload: z.number().min(0).optional(),
  mag: z.number().min(0).optional(),
  capacity: z.number().min(0).optional(),
  recharge_rate: z.number().min(0).optional(),
  recharge_delay: z.number().min(0).optional(),
  absorb_chance: z.number().min(0).max(100).optional(),
  grenade_damage: z.number().min(0).optional(),
  grenade_damage_multiplier: z.number().min(1).optional(),
  blast_radius: z.number().min(0).optional(),
  fuse_time: z.number().min(0).optional(),
  gun_damage_bonus: z.number().optional(),
  weapon_accuracy_bonus: z.number().optional(),
  cooldown_rate_bonus: z.number().optional(),
}).strict();
