import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type Interaction,
} from 'discord.js'

import * as calc from '~/commands/calc'
import { commands } from '~/commands'
import { env } from '~/env'
import { log } from '~/log'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = commands.find((c) => c.data.name === i.commandName)
      if (!cmd) return
      await cmd.execute(i)
      return
    }
    if (i.isButton()) {
      if (i.customId === calc.SHARE_CUSTOM_ID) {
        await calc.handleShare(i)
      }
      return
    }
  } catch (err) {
    log.error(
      { err, type: i.type, customId: 'customId' in i ? i.customId : undefined },
      'interaction handler failed',
    )
    await safeErrorReply(i)
  }
})

const safeErrorReply = async (i: Interaction): Promise<void> => {
  if (!i.isRepliable()) return
  if (i.deferred || i.replied) {
    await i.followUp({ content: 'Internal error.', flags: MessageFlags.Ephemeral })
  } else {
    await i.reply({ content: 'Internal error.', flags: MessageFlags.Ephemeral })
  }
}

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
