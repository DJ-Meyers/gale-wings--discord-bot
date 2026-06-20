import { z } from 'zod'

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  // Dev: scoped guild registration propagates instantly. Global registration
  // takes up to an hour, so leave this set during dev and unset in prod.
  DISCORD_GUILD_ID: z.string().optional(),
  API_URL: z.string().url(),
  // Must match BOT_API_KEY on the api side. ≥32 chars to discourage weak prod
  // values; matched-but-throwaway strings work locally (see plan §7.3).
  BOT_API_KEY: z.string().min(32),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
})

export const env = envSchema.parse(process.env)
