import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js'

import { formatFailure, formatResult } from '~/calc/format'
import { runCalc } from '~/calc/runCalc'
import { log } from '~/log'

export const SHARE_CUSTOM_ID = 'gwcalc:share'

// Built fresh per reply so the disabled variant doesn't mutate a shared
// instance. Label flips to "Shared" once used as visible confirmation that
// the public follow-up went through.
const shareRow = (disabled = false): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SHARE_CUSTOM_ID)
      .setLabel(disabled ? 'Shared' : 'Share to channel')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  )

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
      .setDescription('e.g. "32+ ZardY HH Heat Wave vs 32/20+ Occa Sini"')
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
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
    await interaction.editReply({ embeds: [formatFailure(outcome.reason)] })
    return
  }
  await interaction.editReply({
    embeds: [formatResult(outcome.result, outcome.vs)],
    components: [shareRow()],
  })
}

// Promotes an ephemeral calc reply to a public channel post. The original
// ephemeral message stays visible only to the requester; we disable its button
// in place so the same calc can't be shared twice. Button lives on an
// ephemeral message, so Discord only delivers the click from the original
// requester — no extra auth check needed.
export const handleShare = async (
  interaction: ButtonInteraction,
): Promise<void> => {
  const embed = interaction.message.embeds[0]
  if (!embed) {
    await interaction.reply({
      content: 'Nothing to share.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  await interaction.update({ components: [shareRow(true)] })
  await interaction.followUp({
    content: `<@${interaction.user.id}> shared a calc:`,
    embeds: [embed],
  })

  log.info(
    {
      event: 'calc.share',
      userId: interaction.user.id,
      guildId: interaction.guildId,
    },
    '/gwcalc share',
  )
}
