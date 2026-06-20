import type { DamageCalcResult } from '@dj-meyers/gale-wings/calc'
import { describe, expect, it } from 'vitest'

import { formatResult } from '~/calc/format'

const fixture: DamageCalcResult = {
  desc: '252+ SpA Gardevoir Dazzling Gleam vs. 4 HP Garchomp: 138-164 (78.4 - 93.1%) -- guaranteed 2HKO',
  range: [138, 164],
  koChance: '76.6% chance to OHKO after Stealth Rock',
  defenderMaxHp: 176,
}

describe('formatResult', () => {
  it('puts the percent range in the title', () => {
    const e = formatResult(fixture).toJSON()
    expect(e.title).toBe('78.4% – 93.2%')
  })

  it('code-fences the desc text', () => {
    const e = formatResult(fixture).toJSON()
    expect(e.description).toBe('```' + fixture.desc + '```')
  })

  it('renders KO chance as the only inline field', () => {
    const e = formatResult(fixture).toJSON()
    expect(e.fields).toEqual([
      { name: 'KO chance', value: fixture.koChance, inline: true },
    ])
  })

  it('shows em-dash for empty KO chance', () => {
    const e = formatResult({ ...fixture, koChance: '' }).toJSON()
    expect(e.fields?.[0]?.value).toBe('—')
  })

  it('truncates very long descs inside the 4090-char ceiling', () => {
    const longDesc = 'x'.repeat(5000)
    const e = formatResult({ ...fixture, desc: longDesc }).toJSON()
    // 6 chars of fence + truncated content with `...` tail.
    expect(e.description?.length).toBeLessThanOrEqual(4096)
    expect(e.description?.endsWith('...```')).toBe(true)
  })

  it('strips backticks from desc so the fence cannot be broken', () => {
    const e = formatResult({ ...fixture, desc: 'foo`bar`' }).toJSON()
    expect(e.description).toBe('```foobar```')
  })
})
