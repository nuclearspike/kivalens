import { describe, expect, it } from 'vitest'
import { parseSseFrame } from './aiChat'

describe('Ask KivaLens SSE events', () => {
  it('parses browser ApplicationStorage writes', () => {
    expect(parseSseFrame('data: {"type":"application_storage_set","key":"goal","value":"agriculture"}'))
      .toEqual({ type: 'application_storage_set', key: 'goal', value: 'agriculture' })
  })

  it('ignores malformed frames', () => {
    expect(parseSseFrame('event: message')).toBeNull()
    expect(parseSseFrame('data: not-json')).toBeNull()
  })
})
