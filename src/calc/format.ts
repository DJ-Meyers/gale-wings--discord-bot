import type { DamageCalcResult } from '@dj-meyers/gale-wings/calc'
import { getSpriteUrl } from '@dj-meyers/gale-wings/sprites'
import type { FieldConditions } from '@dj-meyers/gale-wings/types'
import type { AppRouter } from '@dj-meyers/gale-wings--api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { EmbedBuilder } from 'discord.js'

type VsResult = inferRouterOutputs<AppRouter>['parser']['parseVs']

// Discord embed author name ceiling.
const MAX_AUTHOR_NAME = 256

// Exact inverse of statPointToEv in @dj-meyers/gale-wings/calc:
//   sp=0 → 0; sp=1 → 4; sp≥2 → 4 + (sp-1)*8.
// toCalcPokemon always builds @smogon/calc Pokemon from statPointsToEvs(), so
// every stat-spread number in result.desc is one of {0, 4, 12, 20, ..., 252} —
// the inverse is total on those values.
const evToStatPoint = (ev: number): number => {
  if (ev <= 0) return 0
  if (ev <= 4) return 1
  return (ev - 4) / 8 + 1
}

// Rewrite @smogon/calc's EV-based spread tokens ("252+ SpA", "4 HP / 0 Def")
// into Champions stat-point vocabulary so the desc matches what the user
// typed. Match scope is intentionally narrow — a number followed by an
// optional nature sign followed by a stat name and a word boundary — so the
// damage range, KO chance, and the rest of the desc are left alone.
const SPREAD_PATTERN = /(\d+)([+-]?) (HP|Atk|Def|SpA|SpD|Spe)\b/g
const convertDescToStatPoints = (desc: string): string =>
  desc.replace(SPREAD_PATTERN, (_match, evStr: string, sign: string, stat: string) => {
    const sp = evToStatPoint(Number(evStr))
    return `${sp}${sign} ${stat}`
  })

// KO-tier accent stripe on the embed left edge. Mirrors getKoTierColor() in
// client/app/components/calculator/CalcRow/formatSummary.tsx, offensive mode
// (the bot's perspective is always attacker → defender). Hex values are the
// light-mode --color-ko-* tokens from app/index.css.
const KO_COLOR = {
  guaranteedOhko: 0x4caf50,
  chanceOhko: 0xa3c44a,
  guaranteed2hko: 0xe8d44d,
  chance2hko: 0xe8913a,
  no2hko: 0xe05555,
} as const

const koAccentColor = (koChance: string): number | null => {
  if (!koChance) return null
  if (koChance.includes('guaranteed OHKO')) return KO_COLOR.guaranteedOhko
  if (koChance.includes('OHKO')) return KO_COLOR.chanceOhko
  if (koChance.includes('guaranteed 2HKO')) return KO_COLOR.guaranteed2hko
  if (koChance.includes('2HKO')) return KO_COLOR.chance2hko
  return KO_COLOR.no2hko
}

// Splits FieldConditions into the three display groups used by formatModifiers:
//   - Field: weather, terrain, field-wide effects (Gravity, Rooms, Ruin)
//   - Boosts: attacker-side stacks (plus Single Target — it removes the 0.75×
//     spread reduction, so it functions as an attacker-side damage boost)
//   - Mitigation: defender-side stacks
// Defender Tailwind is grouped under Mitigation as a defender-side effect,
// even though it isn't strictly damage-reducing.
//
// `desc` is @smogon/calc's already-rendered KO string. The library only
// emits a modifier into desc when it actually affects damage (e.g. Sun + Fire
// move, Helping Hand, Reflect on a special hit). When desc already mentions a
// modifier, suppress the matching row entry so the same fact isn't shown
// twice. Substrings below mirror @smogon/calc's `desc.ts` emitters verbatim.
// Entries that desc never emits (Gravity, Magic Room, attacker/defender
// Tailwind, Single Target) are pushed unconditionally.
const collectModifiers = (
  fc: FieldConditions,
  isSingleTarget: boolean,
  desc: string,
): { field: string[]; boosts: string[]; mitigation: string[] } => {
  const field: string[] = []
  // Weather standalone: ' in <Weather>'; combined: ' in <Weather> and …'.
  // Both contain ' in <Weather>' as a substring.
  if (fc.weather && !desc.includes(` in ${fc.weather}`)) field.push(fc.weather)
  // Terrain standalone: ' in <Terrain> Terrain'; combined: ' and <Terrain>
  // Terrain'. The shared '<Terrain> Terrain' suffix is unique to the field
  // clauses.
  if (fc.terrain && !desc.includes(`${fc.terrain} Terrain`)) {
    field.push(`${fc.terrain} Terrain`)
  }
  if (fc.isGravity) field.push('Gravity')
  if (fc.isMagicRoom) field.push('Magic Room')
  if (fc.isWonderRoom && !desc.includes('in Wonder Room')) field.push('Wonder Room')
  if (fc.isBeadsOfRuin && !desc.includes('Beads of Ruin')) field.push('Beads of Ruin')
  if (fc.isSwordOfRuin && !desc.includes('Sword of Ruin')) field.push('Sword of Ruin')
  if (fc.isTabletsOfRuin && !desc.includes('Tablets of Ruin')) {
    field.push('Tablets of Ruin')
  }
  if (fc.isVesselOfRuin && !desc.includes('Vessel of Ruin')) {
    field.push('Vessel of Ruin')
  }

  const boosts: string[] = []
  // Tailwind shifts speed for whoever holds it, which changes the BP of
  // speed-driven moves (Electro Ball, Gyro Ball) for either side. Both sides
  // live under Boosts with an explicit side label rather than splitting
  // attacker/defender across Boosts/Mitigation — Tailwind isn't mitigation.
  if (fc.attackerSide?.isTailwind) boosts.push('Tailwind (Attacker)')
  if (fc.defenderSide?.isTailwind) boosts.push('Tailwind (Defender)')
  if (
    fc.attackerSide?.isFlowerGift &&
    !desc.includes("with an ally's Flower Gift")
  ) {
    boosts.push('Flower Gift')
  }
  if (fc.attackerSide?.isPowerSpot && !desc.includes('Power Spot boosted')) {
    boosts.push('Power Spot')
  }
  if (fc.attackerSide?.isBattery && !desc.includes('Battery boosted')) {
    boosts.push('Battery')
  }
  if (isSingleTarget) boosts.push('Single Target')

  const mitigation: string[] = []
  if (fc.defenderSide?.isReflect && !desc.includes('through Reflect')) {
    mitigation.push('Reflect')
  }
  if (
    fc.defenderSide?.isLightScreen &&
    !desc.includes('through Light Screen')
  ) {
    mitigation.push('Light Screen')
  }
  if (
    fc.defenderSide?.isAuroraVeil &&
    !desc.includes("with an ally's Aurora Veil")
  ) {
    mitigation.push('Aurora Veil')
  }
  if (
    fc.defenderSide?.isFriendGuard &&
    !desc.includes("with an ally's Friend Guard")
  ) {
    mitigation.push('Friend Guard')
  }
  if (fc.defenderSide?.isProtected && !desc.includes('protected ')) {
    mitigation.push('Protect')
  }

  return { field, boosts, mitigation }
}

// Renders the modifier block shown inside the embed's code fence. Returns ''
// when nothing is set so the caller can skip setDescription entirely.
export const formatModifiers = (
  fc: FieldConditions | undefined,
  isSingleTarget = false,
  desc = '',
): string => {
  const { field, boosts, mitigation } = collectModifiers(
    fc ?? {},
    isSingleTarget,
    desc,
  )
  const lines: string[] = []
  if (field.length > 0) lines.push(`  - Field: ${field.join(', ')}`)
  if (boosts.length > 0) lines.push(`  - Boosts: ${boosts.join(', ')}`)
  if (mitigation.length > 0) lines.push(`  - Mitigation: ${mitigation.join(', ')}`)
  if (lines.length === 0) return ''
  return ['Modifiers', ...lines].join('\n')
}

export const formatResult = (
  r: DamageCalcResult,
  vs: VsResult,
): EmbedBuilder => {
  const cleaned = convertDescToStatPoints(r.desc)
  const name =
    cleaned.length > MAX_AUTHOR_NAME
      ? `${cleaned.slice(0, MAX_AUTHOR_NAME - 3)}...`
      : cleaned

  const embed = new EmbedBuilder()

  const attackerSpecies = vs.attacker.pokemon.species
  const iconURL = attackerSpecies ? getSpriteUrl(attackerSpecies) : undefined
  embed.setAuthor(iconURL ? { name, iconURL } : { name })

  const modifiers = formatModifiers(
    vs.fieldConditions,
    vs.attacker.pokemon.isSingleTarget ?? false,
    cleaned,
  )
  if (modifiers) embed.setDescription('```\n' + modifiers + '\n```')

  const accent = koAccentColor(r.koChance)
  if (accent !== null) embed.setColor(accent)

  return embed
}

export const formatFailure = (reason: string): EmbedBuilder => {
  // Discord embed description ceiling is 4096; long error blobs from
  // multi-line parser failures get clamped defensively.
  const trimmed = reason.length > 4000 ? `${reason.slice(0, 3997)}...` : reason
  return new EmbedBuilder()
    .setColor(KO_COLOR.no2hko)
    .setTitle("❌ Couldn't run calc")
    .setDescription(trimmed)
}
