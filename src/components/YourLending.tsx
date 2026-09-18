import { useEffect, useState } from 'react'
import { Row, Col, Card } from '../ui'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useCriteriaStore, useUtilsStore } from '../stores'
import { useI18n } from '../i18n'
import { useLatestRef } from '../lib/useLatestRef'

// "Your Lending" — charts of how the signed-in lender's past loans break down,
// from Kiva's SuperGraph data (the same source the portfolio balancers use).

type Slice = { id: string; name: string; value: number; percent: number }

const SLICES: { key: string; label: string }[] = [
  { key: 'sector', label: 'By Sector' },
  { key: 'country', label: 'By Country' },
  { key: 'activity', label: 'By Activity' },
]

export function SliceChart({ sliceBy, label }: { sliceBy: string; label: string }) {
  const { t, sector, number, percent } = useI18n()
  const fetchBalancerData = useCriteriaStore((s) => s.fetchBalancerData)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const [slices, setSlices] = useState<Slice[] | null>(null)
  const [failed, setFailed] = useState(false)

  // Tracks every value the effect below re-runs for, so `generation` bumps
  // for EVERY trigger that starts a new fetch — an exact proxy for "the
  // effect is about to re-run." Same pattern as BalancingRow in
  // CriteriaTabs.tsx (see that file for the fuller writeup of why).
  const effectDeps = [sliceBy, fetchBalancerData, lenderId, sector] as const
  const [prevEffectDeps, setPrevEffectDeps] = useState<readonly unknown[]>(effectDeps)
  // Object.is, not !==, to mirror what React itself uses to decide whether a
  // dependency changed.
  const effectDepsChanged = effectDeps.length !== prevEffectDeps.length || effectDeps.some((d, i) => !Object.is(d, prevEffectDeps[i]))

  // Resets to the loading state (slices === null is the loading sentinel;
  // see the render below) the moment a refetch-worthy trigger is seen,
  // rather than one render behind it via the effect — the "adjust during
  // render" pattern (https://react.dev/learn/you-might-not-need-an-effect).
  const [generation, setGeneration] = useState(0)
  if (effectDepsChanged) {
    setPrevEffectDeps(effectDeps)
    setGeneration((g) => g + 1)
    setSlices(null)
    setFailed(false)
  }

  // The one generation a settling fetch is allowed to write results for —
  // see useLatestRef for why a layout effect, not this effect's own
  // (passive, deferred) cleanup, has to be what keeps this current.
  const activeGenerationRef = useLatestRef(generation)

  useEffect(() => {
    // Per-instance, alongside generation: closes the one gap generation
    // structurally can't on its own — React StrictMode's dev-only
    // setup→cleanup→setup replay runs both instances synchronously with no
    // render in between to bump anything, so they'd share a generation
    // regardless.
    let cancelled = false
    const myGeneration = generation
    // Plain !==/===, not Object.is, is correct here specifically: generation
    // is a counter that only ever starts at 0 and adds 1, so it can never be
    // NaN or -0 — the cases Object.is and !== actually disagree on. Object.is
    // above is for effectDepsChanged, which compares the raw dependency
    // VALUES (lenderId, sector, etc.), where those cases are reachable.
    fetchBalancerData(sliceBy, { enabled: true, allactive: 'all' })
      .then((r) => {
        if (cancelled || activeGenerationRef.current !== myGeneration) return
        const top = [...(r.slices as Slice[])].sort((a, b) => b.value - a.value).slice(0, 12)
        setSlices(sliceBy === 'sector' ? top.map((item) => ({ ...item, name: sector(item.name) })) : top)
      })
      .catch(() => {
        if (!cancelled && activeGenerationRef.current === myGeneration) setFailed(true)
      })
    return () => {
      cancelled = true
    }
    // Same array as effectDeps above, spread rather than re-listed — one
    // source, so the two can't drift out of sync. generation itself always
    // changes in lockstep with these and is deliberately excluded, like fn in
    // useDebouncedEffect (CriteriaTabs.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...effectDeps])

  return (
    <Card className="mb-3">
      <Card.Header>{t(label)}</Card.Header>
      <Card.Body>
        {failed ? (
          <div className="text-muted">{t('couldnt_load_breakdown')}</div>
        ) : !slices ? (
          <div className="text-muted">{t('loading_ellipsis')}</div>
        ) : slices.length === 0 ? (
          <div className="text-muted">{t('no_data')}</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(170, slices.length * 26)}>
            <BarChart data={slices} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const p = (item as unknown as { payload?: Slice }).payload
                  return [t('count_loans_percent_percent', { count: number(value), percent: percent(p?.percent ?? 0, 1) }), p?.name ?? '']
                }}
              />
              <Bar dataKey="value" fill="var(--kl-green)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card.Body>
    </Card>
  )
}

export default function YourLending() {
  const { t } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  if (!lenderId) return null
  return (
    <div className="mb-4">
      <h2>{t('lending')}</h2>
      <p className="text-muted">{t('how_past_kiva_loans_break')}</p>
      <Row>
        {SLICES.map((s) => (
          <Col md={4} key={s.key}>
            <SliceChart sliceBy={s.key} label={s.label} />
          </Col>
        ))}
      </Row>
    </div>
  )
}
