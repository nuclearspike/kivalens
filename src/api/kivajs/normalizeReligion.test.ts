import { describe, it, expect } from 'vitest'
import {
  normalizeReligion,
  processPartnerReligions,
  getReligionSummary,
  RELIGION_CATEGORIES,
} from './normalizeReligion'

describe('normalizeReligion', () => {
  it('returns Unknown for blank input', () => {
    expect(normalizeReligion('')).toEqual(['Unknown'])
    expect(normalizeReligion('   ')).toEqual(['Unknown'])
  })

  it('detects Secular but not "not secular"', () => {
    expect(normalizeReligion('Secular organization')).toEqual(['Secular'])
    expect(normalizeReligion('not secular')).not.toContain('Secular')
  })

  it('classifies Christian, and Christian Influence when softened', () => {
    expect(normalizeReligion('Christian')).toEqual(['Christian'])
    expect(normalizeReligion('Christian, with some influences')).toEqual(['Christian Influence'])
  })

  it('detects Muslim, Hindu, Jewish, Buddhist', () => {
    expect(normalizeReligion('Islamic microfinance')).toEqual(['Muslim'])
    expect(normalizeReligion('Hindu')).toEqual(['Hindu'])
    expect(normalizeReligion('Judaism')).toEqual(['Jewish'])
    expect(normalizeReligion('Buddhist temple')).toEqual(['Buddhist'])
  })

  it('can return multiple categories and deduplicates', () => {
    const res = normalizeReligion('Hindu and Muslim community')
    expect(res).toContain('Hindu')
    expect(res).toContain('Muslim')
    expect(new Set(res).size).toBe(res.length)
  })

  it('maps "presumed" (no other signal) to Secular', () => {
    expect(normalizeReligion('presumed')).toEqual(['Secular'])
  })
})

describe('processPartnerReligions + getReligionSummary', () => {
  it('attaches normalizedReligions and summarizes counts', () => {
    const partners: any[] = [
      { atheistScore: { religiousAffiliation: 'Christian' } },
      { atheistScore: { religiousAffiliation: 'Islamic' } },
      { atheistScore: { religiousAffiliation: '' } },
      {}, // no atheistScore -> Unknown
    ]
    processPartnerReligions(partners)
    expect(partners[0].normalizedReligions).toEqual(['Christian'])
    expect(partners[1].normalizedReligions).toEqual(['Muslim'])

    const summary = getReligionSummary(partners)
    expect(summary.Christian).toBe(1)
    expect(summary.Muslim).toBe(1)
    expect(summary.Unknown).toBe(2)
    // every category is represented in the summary object
    RELIGION_CATEGORIES.forEach((cat) => expect(summary).toHaveProperty(cat))
  })
})
