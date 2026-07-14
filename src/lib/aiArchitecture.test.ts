import { describe, expect, it } from 'vitest'
import {
  RESPONSES_TOOL_DEFS,
  buildResponsesRequest,
  buildSystemPrompt,
  sanitizeApplicationStorage,
} from '../../server/aiChat.mjs'

describe('Ask KivaLens Responses architecture', () => {
  it('uses flattened Responses tools, including isolated application storage', () => {
    const tools = RESPONSES_TOOL_DEFS as Array<Record<string, unknown>>
    expect(tools.length).toBeGreaterThan(30)
    expect(tools.every((tool) => tool.type === 'function' && typeof tool.name === 'string')).toBe(true)
    expect(tools.every((tool) => !('function' in tool))).toBe(true)
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'save_application_storage', 'retrieve_application_storage',
    ]))
  })

  it('builds a stateless Responses streaming request instead of Chat Completions messages', () => {
    const input = [{ role: 'user', content: 'hello' }]
    const request = buildResponsesRequest({ instructions: 'system', input, clientId: 'client-1' }) as Record<string, unknown>
    expect(request.input).toBe(input)
    expect(request.instructions).toBe('system')
    expect(request.stream).toBe(true)
    expect(request.store).toBe(false)
    expect(request.tool_choice).toBe('auto')
    expect(request).not.toHaveProperty('messages')
    expect(request).not.toHaveProperty('max_tokens')
  })

  it('clamps the browser storage snapshot to safe keys, values, and count', () => {
    const input = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`key-${i}`, `value-${i}`]))
    input['../escape'] = 'hidden'
    input['object'] = { secret: true } as unknown as string
    const clean = sanitizeApplicationStorage(input)
    expect(Object.keys(clean)).toHaveLength(32)
    expect(clean).not.toHaveProperty('../escape')
    expect(clean).not.toHaveProperty('object')
  })

  it('teaches the model the local-only storage boundary', () => {
    const prompt = buildSystemPrompt(
      { batch: 1, ready: true, allLoans: [], activePartners: [], optionsGz: null },
      null,
      { loan: {}, partner: {}, portfolio: {} },
    )
    expect(prompt).toContain('APPLICATION STORAGE')
    expect(prompt).toContain('AskKivaLens:')
    expect(prompt).toContain('Never store secrets')
  })

  it('answers in the selected UI language while preserving canonical English tool values', () => {
    const prompt = buildSystemPrompt(
      { batch: 1, ready: true, allLoans: [], activePartners: [], optionsGz: null },
      null,
      { loan: {}, partner: {}, portfolio: {} },
      { locale: 'de' },
    )
    expect(prompt).toContain('Always answer in German')
    expect(prompt).toContain('canonical criteria values, saved-search names, tool arguments')
  })
})
