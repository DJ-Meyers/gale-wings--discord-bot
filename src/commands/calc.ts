import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'

import { formatResult } from '~/calc/format'
import { runCalc } from '~/calc/runCalc'
import { log } from '~/log'

// Per-user cooldown prevents one user from burning the bot's shared
// rate-limit budget at the api parser.
//
// `recent` is per-process and grows unbounded (one entry per userId who has
// ever invoked the command). Acceptable today: Railway redeploys restart the
// process and reset the map; entries are ~30 bytes each. If real usage
// produces >1M unique users between deploys, add a periodic prune of entries
// older than COOLDOWN_MS. Cooldown is per-replica — if the bot ever shards
// horizontally, users could dodge it by hitting different replicas; the api's
// per-source rate-limit becomes the only meaningful backstop.
const COOLDOWN_MS = 3_000
const recent = new Map<string, number>()

export const data = new SlashCommandBuilder()
  .setName('gwcalc')
  .setDescription('Damage calc, Champions VGC')
  .addStringOption((o) =>
    o
      .setName('input')
      .setDescription('e.g. "32+ SpA Gardevoir Dazzling Gleam vs 4 HP Garchomp"')
      .setRequired(true)
      .setMaxLength(500),
  )

export const execute = async (
  interaction: ChatInputCommandInteraction,
): Promise<void> => {
  const userId = interaction.user.id
  const last = recent.get(userId) ?? 0
  if (Date.now() - last < COOLDOWN_MS) {
    await interaction.reply({
      content: 'slow down — try again in a moment',
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  recent.set(userId, Date.now())

  const input = interaction.options.getString('input', true)
  const start = Date.now()
  await interaction.deferReply()
  const outcome = await runCalc(input)

  log.info(
    {
      event: 'calc',
      userId,
      guildId: interaction.guildId,
      inputLength: input.length,
      outcome: outcome.ok ? 'success' : 'failure',
      reason: outcome.ok ? undefined : outcome.reason.slice(0, 200),
      latencyMs: Date.now() - start,
    },
    '/gwcalc',
  )

  if (!outcome.ok) {
    await interaction.editReply({ content: `❌ ${outcome.reason}` })
    return
  }
  await interaction.editReply({ embeds: [formatResult(outcome.result)] })
}
