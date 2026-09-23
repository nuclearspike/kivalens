import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useCriteriaStore } from '../stores'
import { criteriaFromParams, hasCriteriaParams, withCriteria } from '../../server/criteriaUrl.mjs'

// The address is rewritten once the lender stops changing things, not on every
// keystroke in Use or Description: browsers rate-limit history writes, and an
// address flickering through half-typed words is no use to anyone.
const SETTLE_MS = 400

/**
 * Keeps the Search address and the search itself in step.
 *
 * An address naming any criteria IS the search, and replaces whatever the
 * browser had stored — that is what makes a link work. Afterwards the address
 * follows the search, so what is in the bar is always what is on screen and is
 * always worth copying. The address is read on the first render only; reading it
 * again would fight the writing.
 *
 * Every rewrite replaces rather than pushes. Choosing a country is not a place in
 * history, and pushing would bury the page the lender came from under a hundred
 * entries they would have to press Back through.
 *
 * navigate is used rather than setSearchParams because that re-encodes the query
 * through URLSearchParams, turning the readable `country_code=all:KE,UG` into
 * percent escapes.
 */
export function useCriteriaInUrl(active: boolean) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const criteria = useCriteriaStore((s) => s.lastKnown)
  const readFromUrl = useRef(false)

  useEffect(() => {
    if (!active || readFromUrl.current) return
    readFromUrl.current = true
    if (!hasCriteriaParams(searchParams)) return
    const fromUrl = criteriaFromParams(searchParams)
    if (!fromUrl) return
    useCriteriaStore.getState().setCriteria(fromUrl)
    // These criteria came from a link, not from a saved search, so the switcher
    // stops naming one.
    useCriteriaStore.getState().clearLastSwitch()
  }, [active, searchParams])

  useEffect(() => {
    if (!active || !readFromUrl.current) return
    const timer = setTimeout(() => {
      const next = withCriteria(searchParams, criteria)
      if (next === location.search || (!next && !location.search)) return
      navigate({ search: next }, { replace: true })
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [active, criteria, navigate, searchParams, location.search])
}
