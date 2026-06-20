import { REST, Routes } from 'discord.js'

import { commands } from '~/commands'
import { env } from '~/env'

// One-shot script. Run when a command signature changes:
//   pnpm register-commands     # uses DISCORD_GUILD_ID if set, else global
//
// Boot does NOT re-register, so Discord's rate-limit category is preserved
// across restarts and global registration's ~1h propagation isn't wasted on
// every redeploy.

const rest = new REST().setToken(env.DISCORD_BOT_TOKEN)
const route = env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_APPLICATION_ID)

await rest.put(route, {
  body: commands.map((c) => c.data.toJSON()),
})

console.log(
  `registered ${commands.length} command(s) → ${env.DISCORD_GUILD_ID ?? 'global'}`,
)
