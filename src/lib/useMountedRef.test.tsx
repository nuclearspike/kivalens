// @vitest-environment jsdom
import { StrictMode, useLayoutEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { useMountedRef } from './useMountedRef'

describe('useMountedRef', () => {
  it('is true while the component is on the page, also after StrictMode mounts it twice, and false once it has gone', () => {
    let mounted: { readonly current: boolean } | undefined
    function Probe() {
      mounted = useMountedRef()
      return null
    }
    const { unmount } = render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    )
    expect(mounted?.current).toBe(true)
    unmount()
    expect(mounted?.current).toBe(false)
  })

  it('is already false while React takes the component out of the page, before any passive cleanup', () => {
    let atRemoval: boolean | undefined
    function Probe() {
      const mounted = useMountedRef()
      // Runs as the component is taken out, after the hook's own cleanup (declared first).
      useLayoutEffect(() => () => { atRemoval = mounted.current }, [mounted])
      return null
    }
    render(<Probe />).unmount()
    expect(atRemoval).toBe(false)
  })
})
