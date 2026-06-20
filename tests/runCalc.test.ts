import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the trpc client before importing runCalc — runCalc reaches into
// trpc.parser.parseVs at execution time, so we intercept the boundary and
// feed runCalc synthetic VsResult fixtures. computeDamage runs against the
// real @dj-meyers/gale-wings/calc, catching any drift in the bot's
// parsedPokemonToCalcSide adapter or the shared helper itself.
vi.mock('~/trpc', () => ({
  trpc: {
    parser: {
      parseVs: {
        query: vi.fn(),
      },
    },
  },
}))

import { trpc } from '~/trpc'
import { runCalc } from '~/calc/runCalc'

const mockedQuery = vi.mocked(trpc.parser.parseVs.query)

const baseVs = () => ({
  attacker: {
    pokemon: {
      species: 'Floette-Eternal' as const,
      ability: 'Flower Veil' as const,
      nature: 'Modest' as const,
      move: 'Moonblast' as const,
      statPoints: { spa: 32, spe: 24, hp: 4 },
    },
    errors: [],
  },
  defender: {
    pokemon: {
      species: 'Incineroar' as const,
      ability: 'Intimidate' as const,
      nature: 'Careful' as const,
      statPoints: { hp: 30, def: 12, spd: 17 },
    },
    errors: [],
  },
  fieldConditions: {},
})

afterEach(() => {
  mockedQuery.mockReset()
})

describe('runCalc', () => {
  it('produces ok:true with a real DamageCalcResult for a clean parse', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedQuery.mockResolvedValueOnce(baseVs() as any)
    const out = await runCalc('Floette Moonblast vs Incineroar')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.result.range[0]).toBeGreaterThan(0)
    expect(out.result.range[1]).toBeGreaterThanOrEqual(out.result.range[0])
    expect(out.result.defenderMaxHp).toBeGreaterThan(0)
    expect(typeof out.result.desc).toBe('string')
  })

  it('fails closed on schema errors from the parser', async () => {
    const vs = baseVs()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vs.attacker as any).errors = [{ kind: 'schema', path: 'species', message: 'unknown' }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedQuery.mockResolvedValueOnce(vs as any)
    const out = await runCalc('asdf vs jkl')
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toContain('species: unknown')
  })

  it('fails closed when the attacker has no move', async () => {
    const vs = baseVs()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (vs.attacker.pokemon as any).move
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedQuery.mockResolvedValueOnce(vs as any)
    const out = await runCalc('Floette vs Incineroar')
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toMatch(/missing a move/)
  })

  it('fails closed when species is missing on a side', async () => {
    const vs = baseVs()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (vs.defender.pokemon as any).species
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedQuery.mockResolvedValueOnce(vs as any)
    const out = await runCalc('Floette Moonblast vs nothing')
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toMatch(/species \+ ability/)
  })

  it('returns ok:false on unknown move (computeDamage returns null)', async () => {
    const vs = baseVs()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vs.attacker.pokemon as any).move = 'Notamoveatall'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedQuery.mockResolvedValueOnce(vs as any)
    const out = await runCalc('Floette Notamoveatall vs Incineroar')
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toMatch(/Calc failed/)
  })
})
