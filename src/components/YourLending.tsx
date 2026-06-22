import { useEffect, useState } from 'react'
import { Row, Col, Card } from '../ui'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useCriteriaStore, useUtilsStore } from '../stores'

// "Your Lending" — charts of how the signed-in lender's past loans break down,
// from Kiva's SuperGraph data (the same source the portfolio balancers use).

type Slice = { id: string; name: string; value: number; percent: number }

const SLICES: { key: string; label: string }[] = [
  { key: 'sector', label: 'By Sector' },
  { key: 'country', label: 'By Country' },
  { key: 'activity', label: 'By Activity' },
]

function SliceChart({ sliceBy, label }: { sliceBy: string; label: string }) {
  const fetchBalancerData = useCriteriaStore((s) => s.fetchBalancerData)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const [slices, setSlices] = useState<Slice[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setSlices(null)
    setFailed(false)
    fetchBalancerData(sliceBy, { enabled: true, allactive: 'all' })
      .then((r) => {
        if (!active) return
        const top = [...(r.slices as Slice[])].sort((a, b) => b.value - a.value).slice(0, 12)
        setSlices(top)
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [sliceBy, fetchBalancerData, lenderId])

  return (
    <Card className="mb-3">
      <Card.Header>{label}</Card.Header>
      <Card.Body>
        {failed ? (
          <div className="text-muted">Couldn&apos;t load this breakdown.</div>
        ) : !slices ? (
          <div className="text-muted">Loading…</div>
        ) : slices.length === 0 ? (
          <div className="text-muted">No data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(170, slices.length * 26)}>
            <BarChart data={slices} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const p = (item as unknown as { payload?: Slice }).payload
                  return [`${value} loans (${(p?.percent ?? 0).toFixed(1)}%)`, p?.name ?? '']
                }}
              />
              <Bar dataKey="value" fill="#2C8C5E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card.Body>
    </Card>
  )
}

export default function YourLending() {
  const lenderId = useUtilsStore((s) => s.lenderId)
  if (!lenderId) return null
  return (
    <div className="mb-4">
      <h2>Your Lending</h2>
      <p className="text-muted">How your past Kiva loans break down, from your portfolio data.</p>
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
