import { describe, expect, it } from 'vitest'
import { parseSearchPreset, parseSearchPresetTab } from './searchPreset'

describe('KivaLens Lite search handoff presets', () => {
  it('accepts the documented loan, partner, and portfolio criteria', () => {
    expect(parseSearchPreset(JSON.stringify({
      loan: {
        country_code: 'KE,UG',
        country_code_all_any_none: 'any',
        repaid_in_max: 18,
        limit_to: { enabled: true, count: 2, limit_by: 'Country' },
      },
      partner: {
        region: 'af',
        partner_risk_rating_min: 3.5,
      },
      portfolio: {
        exclude_portfolio_loans: 'true',
        pb_country: {
          enabled: true,
          hideshow: 'hide',
          ltgt: 'gt',
          percent: 0,
          allactive: 'all',
        },
      },
    }))).toEqual({
      loan: {
        country_code: 'KE,UG',
        country_code_all_any_none: 'any',
        repaid_in_max: 18,
        limit_to: { enabled: true, count: 2, limit_by: 'Country' },
      },
      partner: {
        region: 'af',
        partner_risk_rating_min: 3.5,
      },
      portfolio: {
        exclude_portfolio_loans: 'true',
        pb_country: {
          enabled: true,
          hideshow: 'hide',
          ltgt: 'gt',
          percent: 0,
          allactive: 'all',
        },
      },
    })
  })

  it('fills omitted groups with empty criteria', () => {
    expect(parseSearchPreset('{"loan":{"activity":"Sewing"}}')).toEqual({
      loan: { activity: 'Sewing' },
      partner: {},
      portfolio: {},
    })
  })

  it('rejects malformed, oversized, unknown, and prototype-shaped input', () => {
    expect(parseSearchPreset('{')).toBeNull()
    expect(parseSearchPreset('x'.repeat(8_001))).toBeNull()
    expect(parseSearchPreset('{"account":{"lenderId":"someone"}}')).toBeNull()
    expect(parseSearchPreset('{"loan":{"__proto__":{"polluted":true}}}')).toBeNull()
    expect(parseSearchPreset('{"loan":{"repaid_in_max":"soon"}}')).toBeNull()
  })

  it('bounds nested controls and numbers', () => {
    expect(parseSearchPreset('{"loan":{"limit_to":{"enabled":true,"count":0,"limit_by":"Country"}}}')).toBeNull()
    expect(parseSearchPreset('{"portfolio":{"pb_country":{"enabled":true,"values":["private"]}}}')).toBeNull()
    expect(parseSearchPreset('{"partner":{"profit_min":1e99}}')).toBeNull()
  })

  it('accepts the three MFI/Direct modes and nothing else', () => {
    for (const direct of ['both', 'mfi', 'direct']) {
      expect(parseSearchPreset(JSON.stringify({ partner: { direct } }))?.partner, direct).toEqual({ direct })
    }
    // Keeps the mode alongside the partner criteria it governs.
    expect(parseSearchPreset(JSON.stringify({ partner: { direct: 'mfi', region: 'af' } }))?.partner).toEqual({ direct: 'mfi', region: 'af' })
    // The old empty value means "not set": accepted and left for the engine to read.
    expect(parseSearchPreset(JSON.stringify({ partner: { direct: '' } }))?.partner).toEqual({})
    expect(parseSearchPreset(JSON.stringify({ partner: { direct: '', region: 'af' } }))?.partner).toEqual({ region: 'af' })
    // KivaLens Lite's own help link for Direct loans.
    expect(parseSearchPreset(JSON.stringify({ partner: { direct: 'direct' } }))?.partner).toEqual({ direct: 'direct' })
    // Anything else fails the whole preset closed, as every other bad value does.
    for (const direct of ['MFI', 'mfi_only', 'yes', 1, null, true]) {
      expect(parseSearchPreset(JSON.stringify({ partner: { direct } })), JSON.stringify(direct)).toBeNull()
    }
  })

  it('accepts only real criteria tabs', () => {
    expect(parseSearchPresetTab('borrower')).toBe('borrower')
    expect(parseSearchPresetTab('partner')).toBe('partner')
    expect(parseSearchPresetTab('portfolio')).toBe('portfolio')
    expect(parseSearchPresetTab('rss')).toBe('rss')
    expect(parseSearchPresetTab('admin')).toBeNull()
  })
})
