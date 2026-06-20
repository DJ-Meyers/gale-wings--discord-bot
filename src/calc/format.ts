import type { DamageCalcResult } from '@dj-meyers/gale-wings/calc'
import { EmbedBuilder } from 'discord.js'

// Discord embed description is 4096 chars; the code fence below adds 6
// (```...```), so 4090 is the real ceiling for `desc` content.
const MAX_DESC = 4090

// Backticks in `desc` would close the triple-backtick fence early and produce
// broken markdown. @smogon/calc descs don't currently contain them, but a
// future ability/move/item name with a backtick would silently break output —
// strip defensively.
const sanitize = (s: string): string => s.replace(/`/g, '')

export const formatResult = (r: DamageCalcResult): EmbedBuilder => {
  const pct = (n: number): string =>
    ((n / r.defenderMaxHp) * 100).toFixed(1)
  const range = `${pct(r.range[0])}% – ${pct(r.range[1])}%`
  const cleaned = sanitize(r.desc)
  const desc =
    cleaned.length > MAX_DESC ? `${cleaned.slice(0, MAX_DESC - 3)}...` : cleaned
  return new EmbedBuilder()
    .setTitle(range)
    .setDescription('```' + desc + '```')
    .addFields({ name: 'KO chance', value: r.koChance || '—', inline: true })
}
