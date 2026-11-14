import { useLayoutEffect, useRef } from 'react'

/**
 * Whether the component is still on the page, for async work that may finish after it has gone:
 * a click's request, a load started on mount. It is false from the moment React takes the
 * component out of the page; it is set again on every mount, since StrictMode mounts twice.
 *
 * It is a layout effect, not a passive one: React runs a removed component's passive cleanup
 * later than it takes the component out of the page, and work can land in between.
 *
 * Work that finishes after the component has gone sets no state and schedules nothing. React
 * drops such an update anyway, but it reads the page's window to schedule it (outside a
 * transition), and a test file's window can be gone by then (release gate, 2026-11-13). This says only that the
 * component is mounted: work whose answer can arrive after a newer ask of the same component
 * (another lender, another loan, a second refresh) needs its own check for that.
 */
export function useMountedRef(): { readonly current: boolean } {
  const mounted = useRef(true)
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return mounted
}
