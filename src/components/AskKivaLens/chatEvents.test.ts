import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The assistant acts on the page through events the server streams
 * (server/aiChat.mjs, `sse({ type })`). An event the page has no case for is
 * dropped without a sound: the assistant says it opened Send Feedback and nothing
 * opens. So every type the server sends needs a case in AskKivaLens.tsx's event
 * handler. The handler's `never` default covers the client's own ChatEvent list.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

function handlerCases(): Set<string> {
  const source = read('src/components/AskKivaLens/AskKivaLens.tsx')
  const start = source.indexOf('const onEvent = (e: ChatEvent) =>')
  const end = source.indexOf('void streamChat(', start)
  if (start < 0 || end < 0) throw new Error('The event handler moved: point chatEvents.test.ts at it')
  return new Set([...source.slice(start, end).matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]))
}

const sent = [...new Set([...read('server/aiChat.mjs').matchAll(/sse\(\{ type: '([a-z_]+)'/g)].map((m) => m[1]))].sort()

describe('every event the assistant sends is handled by the page', () => {
  it('finds the events the server sends', () => {
    expect(sent).toContain('open_feedback')
    expect(sent.length).toBeGreaterThan(20)
  })

  const handled = handlerCases()
  it.each(sent)('%s has a case in the event handler', (type) => {
    expect(handled.has(type)).toBe(true)
  })
})
