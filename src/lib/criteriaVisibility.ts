import { useCallback, useEffect, useState } from 'react'

// Whether the Search page shows its criteria column. Remembered per browser, so a
// lender who works by flipping between saved searches with the facets out of the
// way comes back to that layout. Storage that is blocked or broken means "shown":
// the toggle still works, it is just not remembered.
export const SHOW_CRITERIA_KEY = 'kl_show_criteria'

export function readShowCriteria(): boolean {
  try {
    return localStorage.getItem(SHOW_CRITERIA_KEY) !== 'false'
  } catch {
    return true
  }
}

export function useShowCriteria(): [shown: boolean, toggle: () => void] {
  const [shown, setShown] = useState(readShowCriteria)
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_CRITERIA_KEY, String(shown))
    } catch {
      // not remembered; nothing else depends on it
    }
  }, [shown])
  const toggle = useCallback(() => setShown((v) => !v), [])
  return [shown, toggle]
}
