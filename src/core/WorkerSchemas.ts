import { z } from "zod";
import { GameConfigSchema } from "./Schemas";

export const CreateGameInputSchema = GameConfigSchema.or(
  z
    .object({})
    .strict()
    .transform((val) => undefined),
);

export const GameInputSchema = GameConfigSchema.partial().extend({
  // Host's per-client team pins. Key is clientID; value is the team name
  // (e.g. "Red") or null to clear the pin (revert to auto-balance).
  clientTeams: z.record(z.string(), z.string().nullable()).optional(),
});
