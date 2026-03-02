import { z } from "zod";

export const Type = z.enum([
  "Repeater",
  "Revolver",
  "Pistol",
  "SMG",
  "Assault Rifle",
  "Shotgun",
  "Sniper",
  "Launcher",
  "Eridian",
]);
