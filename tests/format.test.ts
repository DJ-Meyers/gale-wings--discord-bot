import type { DamageCalcResult } from '@dj-meyers/gale-wings/calc'
import { spriteManifest } from '@dj-meyers/gale-wings/sprites'
import type { FieldConditions } from '@dj-meyers/gale-wings/types'
import type { AppRouter } from '@dj-meyers/gale-wings--api-types'
import type { inferRouterOutputs } from '@trpc/server'
import { describe, expect, it } from 'vitest'

import {
  formatFailure,
  formatModifiers,
  formatResult,
} from '~/calc/format'

type VsResult = inferRouterOutputs<AppRouter>['parser']['parseVs']

const result: DamageCalcResult = {
  desc: '252+ SpA Gardevoir Dazzling Gleam vs. 4 HP Garchomp: 138-164 (78.4 - 93.1%) -- guaranteed 2HKO',
  range: [138, 164],
  koChance: '76.6% chance to OHKO after Stealth Rock',
  defenderMaxHp: 176,
}

const vs: VsResult = {
  attacker: {
    pokemon: { species: 'Gardevoir', move: 'Dazzling Gleam' },
    errors: [],
  },
  defender: {
    pokemon: { species: 'Garchomp' },
    errors: [],
  },
  fieldConditions: {},
}

describe('formatResult — title row (author)', () => {
  it('puts the full KO string in the author name', () => {
    const e = formatResult(result, vs).toJSON()
    expect(e.author?.name).toBe(
      '32+ SpA Gardevoir Dazzling Gleam vs. 1 HP Garchomp: 138-164 (78.4 - 93.1%) -- guaranteed 2HKO',
    )
  })

  it('rewrites multi-stat spreads (28 → 4 SP, 0 → 0 SP)', () => {
    const e = formatResult(
      {
        ...result,
        desc: '252+ SpA Gardevoir Dazzling Gleam vs. 28 HP / 0 Def Garchomp: 138-164 (78.4 - 93.1%) -- guaranteed 2HKO',
      },
      vs,
    ).toJSON()
    expect(e.author?.name).toBe(
      '32+ SpA Gardevoir Dazzling Gleam vs. 4 HP / 0 Def Garchomp: 138-164 (78.4 - 93.1%) -- guaranteed 2HKO',
    )
  })

  it('does not touch the damage range or KO chance numbers', () => {
    const e = formatResult(
      { ...result, desc: 'foo: 138-164 (78.4 - 93.1%) -- 28HKO chance' },
      vs,
    ).toJSON()
    expect(e.author?.name).toBe('foo: 138-164 (78.4 - 93.1%) -- 28HKO chance')
  })

  it('truncates very long descs inside the 256-char author-name ceiling', () => {
    const longDesc = 'x'.repeat(500)
    const e = formatResult({ ...result, desc: longDesc }, vs).toJSON()
    expect(e.author?.name?.length).toBeLessThanOrEqual(256)
    expect(e.author?.name?.endsWith('...')).toBe(true)
  })

  it('does not set an embed description when no field conditions are set', () => {
    const e = formatResult(result, vs).toJSON()
    expect(e.description).toBeUndefined()
  })

  it('attaches the attacker sprite as the author icon', () => {
    const e = formatResult(result, vs).toJSON()
    expect(e.author?.icon_url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\//)
    expect(e.author?.icon_url).toContain(spriteManifest.entries['Gardevoir'])
  })

  it('still sets an author name when no sprite is found', () => {
    const noSpecies: VsResult = {
      ...vs,
      attacker: { pokemon: { move: 'Dazzling Gleam' }, errors: [] },
    }
    const e = formatResult(result, noSpecies).toJSON()
    expect(e.author?.name).toBeDefined()
    expect(e.author?.icon_url).toBeUndefined()
  })
})

describe('formatResult — KO accent stripe', () => {
  const cases: Array<[string, number]> = [
    ['guaranteed OHKO', 0x4caf50],
    ['76.6% chance to OHKO', 0xa3c44a],
    ['guaranteed 2HKO', 0xe8d44d],
    ['38.5% chance to 2HKO', 0xe8913a],
    ['possible 5HKO', 0xe05555],
  ]
  for (const [koChance, color] of cases) {
    it(`${koChance} → 0x${color.toString(16)}`, () => {
      const e = formatResult({ ...result, koChance }, vs).toJSON()
      expect(e.color).toBe(color)
    })
  }

  it('empty koChance → no color stripe', () => {
    const e = formatResult({ ...result, koChance: '' }, vs).toJSON()
    expect(e.color).toBeUndefined()
  })
})

describe('formatResult — modifiers block', () => {
  it('renders categorized modifiers in a code fence in the description', () => {
    const withField: VsResult = {
      ...vs,
      fieldConditions: {
        weather: 'Sun',
        terrain: 'Psychic',
        isGravity: true,
        attackerSide: { isFlowerGift: true },
        defenderSide: { isFriendGuard: true, isLightScreen: true },
      },
    }
    const e = formatResult(result, withField).toJSON()
    expect(e.description).toBe(
      '```\nModifiers\n  - Field: Sun, Psychic Terrain, Gravity\n  - Boosts: Flower Gift\n  - Mitigation: Light Screen, Friend Guard\n```',
    )
    expect(e.fields).toBeUndefined()
  })

  it('omits empty group rows', () => {
    const withField: VsResult = {
      ...vs,
      fieldConditions: { attackerSide: { isTailwind: true } },
    }
    const e = formatResult(result, withField).toJSON()
    expect(e.description).toBe('```\nModifiers\n  - Boosts: Tailwind (Attacker)\n```')
  })

  it('omits the description when no conditions are set', () => {
    const e = formatResult(result, vs).toJSON()
    expect(e.description).toBeUndefined()
  })

  it('renders Single Target from the attacker pokemon flag', () => {
    const withSingleTarget: VsResult = {
      ...vs,
      attacker: {
        pokemon: { species: 'Gardevoir', move: 'Dazzling Gleam', isSingleTarget: true },
        errors: [],
      },
    }
    const e = formatResult(result, withSingleTarget).toJSON()
    expect(e.description).toBe('```\nModifiers\n  - Boosts: Single Target\n```')
  })
})

describe('formatModifiers', () => {
  it('returns empty string when input is undefined', () => {
    expect(formatModifiers(undefined)).toBe('')
  })

  it('returns empty string for an empty conditions object', () => {
    expect(formatModifiers({})).toBe('')
  })

  it('renders weather + terrain under Field', () => {
    const fc: FieldConditions = { weather: 'Sun', terrain: 'Grassy' }
    expect(formatModifiers(fc)).toBe(
      'Modifiers\n  - Field: Sun, Grassy Terrain',
    )
  })

  it('renders ruin flags under Field with canonical names', () => {
    const fc: FieldConditions = { isBeadsOfRuin: true, isSwordOfRuin: true }
    expect(formatModifiers(fc)).toBe(
      'Modifiers\n  - Field: Beads of Ruin, Sword of Ruin',
    )
  })

  it('groups defender-side effects under Mitigation', () => {
    const fc: FieldConditions = {
      defenderSide: { isReflect: true, isLightScreen: true, isFriendGuard: true },
    }
    expect(formatModifiers(fc)).toBe(
      'Modifiers\n  - Mitigation: Reflect, Light Screen, Friend Guard',
    )
  })

  it('renders both Tailwinds under Boosts with explicit side labels', () => {
    const fc: FieldConditions = {
      attackerSide: { isTailwind: true },
      defenderSide: { isTailwind: true },
    }
    expect(formatModifiers(fc)).toBe(
      'Modifiers\n  - Boosts: Tailwind (Attacker), Tailwind (Defender)',
    )
  })

  it('appends Single Target to Boosts when the flag is set', () => {
    expect(formatModifiers({}, true)).toBe('Modifiers\n  - Boosts: Single Target')
  })

  it('places Single Target after existing attacker-side boosts', () => {
    const fc: FieldConditions = { attackerSide: { isFlowerGift: true } }
    expect(formatModifiers(fc, true)).toBe(
      'Modifiers\n  - Boosts: Flower Gift, Single Target',
    )
  })

  it('drops weather from Field when the desc already says "in <Weather>"', () => {
    const fc: FieldConditions = { weather: 'Sun' }
    const desc = 'Charizard Heat Wave vs. Garchomp in Sun: 100-120 -- guaranteed 2HKO'
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('drops terrain from Field when the desc already says "in <Terrain> Terrain"', () => {
    const fc: FieldConditions = { terrain: 'Electric' }
    const desc = 'Raichu Rising Voltage vs. Scrafty in Electric Terrain: …'
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('drops both when the desc uses the combined "in <Weather> and <Terrain> Terrain" form', () => {
    const fc: FieldConditions = { weather: 'Sun', terrain: 'Electric' }
    const desc = '… in Sun and Electric Terrain: …'
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('keeps weather in Field when the desc does NOT mention it', () => {
    const fc: FieldConditions = { weather: 'Sun' }
    const desc = 'Garchomp Earthquake vs. Tyranitar: 100-120 -- guaranteed 2HKO'
    expect(formatModifiers(fc, false, desc)).toBe('Modifiers\n  - Field: Sun')
  })

  it('keeps Gravity / Ruin / Rooms even when weather is in desc', () => {
    const fc: FieldConditions = { weather: 'Sun', isGravity: true }
    const desc = '… in Sun: …'
    expect(formatModifiers(fc, false, desc)).toBe('Modifiers\n  - Field: Gravity')
  })

  it('drops Ruin/Wonder Room from Field when desc already names them', () => {
    const fc: FieldConditions = {
      isBeadsOfRuin: true,
      isSwordOfRuin: true,
      isTabletsOfRuin: true,
      isVesselOfRuin: true,
      isWonderRoom: true,
    }
    const desc =
      'Beads of Ruin Sword of Ruin Garchomp Earthquake vs. Tablets of Ruin Vessel of Ruin Tyranitar in Wonder Room: …'
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('keeps Gravity and Magic Room since desc never emits them', () => {
    const fc: FieldConditions = { isGravity: true, isMagicRoom: true }
    const desc = 'attacker Move vs. defender: …'
    expect(formatModifiers(fc, false, desc)).toBe(
      'Modifiers\n  - Field: Gravity, Magic Room',
    )
  })

  it('drops desc-emitted attacker Boosts (Flower Gift, Power Spot, Battery)', () => {
    const fc: FieldConditions = {
      attackerSide: { isFlowerGift: true, isPowerSpot: true, isBattery: true },
    }
    const desc =
      "Charizard with an ally's Flower Gift Power Spot boosted Battery boosted Heat Wave vs. Garchomp: …"
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('keeps Tailwind in Boosts (desc never emits it)', () => {
    const fc: FieldConditions = { attackerSide: { isTailwind: true } }
    const desc =
      "Charizard with an ally's Flower Gift Heat Wave vs. Garchomp: …"
    expect(formatModifiers(fc, false, desc)).toBe(
      'Modifiers\n  - Boosts: Tailwind (Attacker)',
    )
  })

  it('drops desc-emitted Mitigation (Reflect, Light Screen, Aurora Veil, Friend Guard, Protect)', () => {
    const fc: FieldConditions = {
      defenderSide: {
        isReflect: true,
        isLightScreen: true,
        isAuroraVeil: true,
        isFriendGuard: true,
        isProtected: true,
      },
    }
    const desc =
      "Gardevoir Dazzling Gleam vs. protected Garchomp through Reflect through Light Screen with an ally's Aurora Veil with an ally's Friend Guard: …"
    expect(formatModifiers(fc, false, desc)).toBe('')
  })

  it('keeps defender Tailwind in Boosts with explicit side label (desc never emits it)', () => {
    const fc: FieldConditions = { defenderSide: { isTailwind: true } }
    const desc = 'Gardevoir Dazzling Gleam vs. Garchomp through Reflect: …'
    expect(formatModifiers(fc, false, desc)).toBe(
      'Modifiers\n  - Boosts: Tailwind (Defender)',
    )
  })
})

describe('formatFailure', () => {
  it('uses the red KO color so the stripe matches a "no KO" outcome visually', () => {
    const e = formatFailure('unmatched token: foo').toJSON()
    expect(e.color).toBe(0xe05555)
  })

  it('uses the ❌ Couldn\'t run calc title', () => {
    const e = formatFailure('something').toJSON()
    expect(e.title).toBe("❌ Couldn't run calc")
  })

  it('puts the reason in the description verbatim (multi-line preserved)', () => {
    const reason = 'unmatched token: foo\n(root): expected species'
    const e = formatFailure(reason).toJSON()
    expect(e.description).toBe(reason)
  })

  it('truncates very long reasons under the 4096 description ceiling', () => {
    const reason = 'x'.repeat(5000)
    const e = formatFailure(reason).toJSON()
    expect(e.description?.length).toBeLessThanOrEqual(4096)
    expect(e.description?.endsWith('...')).toBe(true)
  })
})
