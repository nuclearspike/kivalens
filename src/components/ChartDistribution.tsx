import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { KivaLoan } from '../types'
import { useI18n } from '../i18n'

// -- Color palette for chart segments --
const COLORS = [
  '#4a8b5c', '#e8a838', '#5b8bd4', '#d45b5b', '#8b5bd4',
  '#d4a05b', '#5bd4a0', '#d45ba0', '#5bd4d4', '#a0d45b',
  '#7c5b2e', '#2e7c5b', '#5b2e7c', '#7c2e5b', '#2e5b7c',
  '#c47a3a', '#3ac47a', '#7a3ac4', '#c43a7a', '#3a7ac4',
]

type ChartMode = 'pie' | 'bar'

interface ChartDistributionProps {
  loans: KivaLoan[]
  /** Which field to group by: 'sector' | 'country' | 'activity' */
  groupBy: 'sector' | 'country' | 'activity'
  /** Chart type. Defaults to 'pie'. */
  mode?: ChartMode
  /** Chart height in pixels. Defaults to 250. */
  height?: number
  /** Title to display above the chart */
  title?: string
}

interface ChartDatum {
  name: string
  value: number
}

function groupLoans(loans: KivaLoan[], field: 'sector' | 'country' | 'activity'): ChartDatum[] {
  const map = new Map<string, number>()
  for (const loan of loans) {
    const key =
      field === 'country'
        ? loan.location.country
        : loan[field]
    const label = key || '(unknown)'
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export default function ChartDistribution({
  loans,
  groupBy: field,
  mode = 'pie',
  height = 250,
  title,
}: ChartDistributionProps) {
  const { sector } = useI18n()
  const data = useMemo(() => {
    const grouped = groupLoans(loans, field)
    return field === 'sector'
      ? grouped.map((item) => ({ ...item, name: sector(item.name) }))
      : grouped
  }, [loans, field, sector])

  if (data.length === 0) {
    return null
  }

  return (
    <div className="mb-3">
      {title && <h6 className="text-muted text-center mb-1">{title}</h6>}
      <ResponsiveContainer width="100%" height={height}>
        {mode === 'bar' ? (
          <BarChart data={data.slice(0, 20)} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#4a8b5c" />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              dataKey="value"
              nameKey="name"
              label={(props: { name?: string; percent?: number }) =>
                (props.percent ?? 0) > 0.04
                  ? `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  : ''
              }
              labelLine={false}
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [String(value), 'Loans']}
            />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * A convenience component that shows all three distributions side by side.
 */
export function ChartDistributionTriple({
  loans,
  mode = 'pie',
  height = 200,
}: {
  loans: KivaLoan[]
  mode?: ChartMode
  height?: number
}) {
  const { t } = useI18n()
  if (loans.length === 0) return null

  return (
    <div className="row d-none d-md-flex">
      <div className="col-md-4">
        <ChartDistribution loans={loans} groupBy="country" mode={mode} height={height} title={t('Countries')} />
      </div>
      <div className="col-md-4">
        <ChartDistribution loans={loans} groupBy="sector" mode={mode} height={height} title={t('Sectors')} />
      </div>
      <div className="col-md-4">
        <ChartDistribution loans={loans} groupBy="activity" mode={mode} height={height} title={t('Activities')} />
      </div>
    </div>
  )
}
