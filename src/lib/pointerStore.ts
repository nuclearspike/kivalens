import { useSyncExternalStore } from 'react'

/**
 * A value that changes as the pointer moves, kept outside React state.
 *
 * Setting React state on hover re-renders whatever owns that state. In a
 * Recharts chart that re-render replaces the bar elements, and a click is only
 * delivered when mousedown and mouseup land on the same element — so a band
 * pressed in the same motion that entered it was swapped out mid-press, and the
 * click never arrived. Measured: pointing at one band replaced 13 of the chart's
 * 17 bar nodes.
 *
 * Here only the components that READ the value re-render when it changes; the
 * chart that WRITES it does not. It does not use state for this because state is
 * exactly what caused the re-render.
 */
export interface PointerStore<T> {
  get: () => T | null
  set: (next: T | null) => void
  subscribe: (listener: () => void) => () => void
}

export function createPointerStore<T>(same: (a: T, b: T) => boolean = Object.is): PointerStore<T> {
  let value: T | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      // An enter for the band already held wakes nobody. Leaving a band always
      // does (it clears the value); moving straight onto the next one fires the
      // leave and the enter in the same browser task, so nothing is painted
      // between them.
      if (next === value || (next !== null && value !== null && same(next, value))) return
      value = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The current value, re-rendering only the component that asks for it. */
export function usePointerValue<T>(store: PointerStore<T>): T | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
