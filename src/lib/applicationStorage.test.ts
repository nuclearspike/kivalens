// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ASK_KIVALENS_STORAGE_PREFIX,
  readAskKivaLensStorage,
  writeAskKivaLensStorage,
} from './applicationStorage'

describe('Ask KivaLens ApplicationStorage namespace', () => {
  beforeEach(() => localStorage.clear())

  it('reads only values owned by the AskKivaLens prefix', () => {
    localStorage.setItem('unrelated-secret', 'not visible')
    localStorage.setItem(`${ASK_KIVALENS_STORAGE_PREFIX}lending.goal`, 'agriculture')
    expect(readAskKivaLensStorage()).toEqual({ 'lending.goal': 'agriculture' })
  })

  it('writes the fixed prefix and rejects unsafe keys', () => {
    expect(writeAskKivaLensStorage('preference.region', 'Latin America')).toBe(true)
    expect(localStorage.getItem('AskKivaLens:preference.region')).toBe('Latin America')
    expect(writeAskKivaLensStorage('../other-app', 'bad')).toBe(false)
  })

  it('rejects values over the per-key limit', () => {
    expect(writeAskKivaLensStorage('too-large', 'x'.repeat(4097))).toBe(false)
  })
})
