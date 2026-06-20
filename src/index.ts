import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js'

import { commands } from '~/commands'
import { env } from '~/env'
import { log } from '~/log'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return
  const cmd = commands.find((c) => c.data.name === i.commandName)
  if (!cmd) return
  try {
    await cmd.execute(i)
  } catch (err) {
    log.error({ err, commandName: i.commandName }, 'command execution failed')
    if (i.deferred || i.replied) {
      await i.editReply('Internal error.')
    } else {
      await i.reply({
        content: 'Internal error.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }
})

client.once(Events.ClientReady, (c) => {
  log.info({ tag: c.user.tag }, 'bot ready')
})

// Railway rolling deploys send SIGTERM and wait ~30s before SIGKILL. Without
// client.destroy() Discord may hold the previous session briefly during the
// swap, surfacing as duplicate handlers on a single interaction.
const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'shutting down')
  await client.destroy()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

await client.login(env.DISCORD_BOT_TOKEN)
