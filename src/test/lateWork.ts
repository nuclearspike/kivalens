// Async work that finishes after its component, or its test, has gone. On 2026-11-13 a load that
// landed after a test file's jsdom was torn down failed the release gate: the component set its
// state, React read the missing window to schedule the update, and the throw escaped
// (analysis/gates/2026-11-13T07-10-29_aca549f2/tests.log).

// Node's own, typed here because the app's type check has no Node types. The setImmediate is
// taken before any test fakes timers, so a turn of the event loop is always a real one.
type Listener = (reason: unknown) => void
const node = globalThis as unknown as {
  process: { on(event: string, listener: Listener): void; off(event: string, listener: Listener): void }
  setImmediate: (callback: () => void) => unknown
}
const realSetImmediate = node.setImmediate

/** One real turn of the event loop: every pending promise callback has run, and Node has raised
 *  any rejection nobody handled. */
export const turn = () => new Promise<void>((resolve) => { realSetImmediate(resolve) })

/**
 * Runs `land` (which settles some async work the test is holding) with the page's window gone, as
 * it is once a test file's jsdom has been torn down, lets the promise callbacks it set off run (two
 * turns of the event loop), and returns what escaped, or throws what `land` itself threw.
 *
 * What it shows: React reads the window to schedule a state update, so an update made there
 * throws, and unless the code catches that throw it escapes and is returned. What it does not
 * show: an update the code's own catch swallows (check what that catch reports as well, as the
 * Teams and translation cases do), one made inside a transition (which does not read the window),
 * a timer the work starts for later (count timers, as the CopyButton and catalog cases do), or
 * work that was already free to run before `land`: that runs in the turns let pass first, while
 * the window is still there. Only work the test holds until `land` is observed.
 */
export async function escapesWithNoWindow(land: () => unknown): Promise<unknown[]> {
  const escaped: unknown[] = []
  const note = (reason: unknown) => { escaped.push(reason) }
  // Work React has already queued for the page reads the window as well: a passive-effect flush
  // after an update made outside act (while a findBy* waited, say) runs from React's scheduler on
  // a later turn, and under load can still be waiting. It runs here, while the page is there; its
  // queue is first in, first out, so these turns come after it.
  await turn()
  await turn()
  node.process.on('unhandledRejection', note)
  node.process.on('uncaughtException', note)
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true })
  try {
    land()
    await turn()
    await turn()
  } finally {
    if (saved) Object.defineProperty(globalThis, 'window', saved)
    else delete (globalThis as { window?: unknown }).window
    node.process.off('unhandledRejection', note)
    node.process.off('uncaughtException', note)
  }
  return escaped
}

/** A promise the test settles when it chooses. */
export function held<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
