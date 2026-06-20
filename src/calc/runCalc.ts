import {
  computeDamage,
  parsedPokemonToCalcSide,
  type DamageCalcResult,
} from '@dj-meyers/gale-wings/calc'
import type { AppRouter } from '@dj-meyers/gale-wings--api-types'
import type { ParseError } from '@dj-meyers/gale-wings/types'
import type { inferRouterOutputs } from '@trpc/server'

import { trpc } from '~/trpc'

// The wire shape is the source of truth: tRPC's inferRouterOutputs derives
// VsResult from the router, so the bot stays in sync if the parser output
// shape evolves.
type VsResult = inferRouterOutputs<AppRouter>['parser']['parseVs']

export type CalcOutcome =
  | { ok: true; result: DamageCalcResult; vs: VsResult }
  | { ok: false; reason: string; vs?: VsResult }

const formatError = (e: ParseError): string =>
  e.kind === 'schema'
    ? `${e.path || '(root)'}: ${e.message}`
    : `unmatched token: ${e.token}`

const formatErrors = (errors: ReadonlyArray<ParseError>): string =>
  errors.map(formatError).join('\n')

export const runCalc = async (input: string): Promise<CalcOutcome> => {
  const vs = await trpc.parser.parseVs.query({ input })

  // Bot rejects ambiguous parses up-front. The web sandbox lets the user see
  // partial state; Discord has one shot to be useful.
  const errors = [...vs.attacker.errors, ...vs.defender.errors]
  if (errors.length > 0) {
    return { ok: false, vs, reason: formatErrors(errors) }
  }

  const attackerSide = parsedPokemonToCalcSide(vs.attacker.pokemon)
  const defenderSide = parsedPokemonToCalcSide(vs.defender.pokemon)
  if (!attackerSide || !defenderSide) {
    return {
      ok: false,
      vs,
      reason: 'Need species + ability on both sides and a move on the attacker.',
    }
  }
  const move = vs.attacker.pokemon.move
  if (!move) {
    return { ok: false, vs, reason: 'Attacker is missing a move.' }
  }

  const result = computeDamage(
    attackerSide,
    defenderSide,
    move,
    vs.fieldConditions ?? {},
    { isSingleTarget: vs.attacker.pokemon.isSingleTarget ?? false },
  )

  if (!result) {
    return { ok: false, vs, reason: 'Calc failed (unknown species/move or bad input).' }
  }
  return { ok: true, vs, result }
}
