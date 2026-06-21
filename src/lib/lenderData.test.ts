import { describe, it, expect } from 'vitest'
import { resolveBalancerValues } from '../../server/lenderData.mjs'

const slices = [
  { id: '1', name: 'Agriculture', value: 50, percent: 50 },
  { id: '2', name: 'Retail', value: 30, percent: 30 },
  { id: '3', name: 'Food', value: 20, percent: 20 },
]

describe('resolveBalancerValues', () => {
  it('gt keeps slices above the percent threshold (by name)', () => {
    expect(resolveBalancerValues({ ltgt: 'gt', percent: 25 }, slices, 'sector')).toEqual([
      'Agriculture',
      'Retail',
    ])
  })

  it('lt keeps slices below the percent threshold (by name)', () => {
    expect(resolveBalancerValues({ ltgt: 'lt', percent: 25 }, slices, 'sector')).toEqual(['Food'])
  })

  it('partner slices resolve to numeric ids', () => {
    expect(resolveBalancerValues({ ltgt: 'gt', percent: 25 }, slices, 'partner')).toEqual([1, 2])
  })

  it('treats a missing threshold as 0', () => {
    expect(resolveBalancerValues({ ltgt: 'gt' }, slices, 'sector')).toEqual([
      'Agriculture',
      'Retail',
      'Food',
    ])
  })
})
