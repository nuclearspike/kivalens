import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Container, Row, Col, Card, Form, Alert } from '../ui'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { req } from '../api/kivajs/req'
import { LenderTeams } from '../api/kivajs/LenderTeams'
import { useUtilsStore } from '../stores'
import LenderIdPitch from './LenderIdPitch'
import { useI18n, type Locale } from '../i18n'

interface Team {
  id: number
  name: string
}

type GraphType = 'team_new_users' | 'team_loan_count'
type TeamSeriesMap = Record<number, Array<[number, number]>>

const SERIES_COLORS = [
  '#2c8c5e',
  '#4e79a7',
  '#e15759',
  '#f28e2b',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
]

function formatXAxisLabel(value: number, locale: Locale) {
  return new Date(value).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}

function formatTooltipLabel(value: number, locale: Locale) {
  return new Date(value).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Teams comparison page.
 * Lets lenders compare Kiva lending teams via membership and loan count charts.
 */
export default function Teams() {
  const { t, locale, number } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  // When the user sets their Lender ID via the in-page modal link below, reload
  // once it lands so this tab (and the nav) re-initialize with portfolio data.
  const reloadAfterLenderSet = useRef(false)
  useEffect(() => {
    if (reloadAfterLenderSet.current && lenderId) location.reload()
  }, [lenderId])
  const lenderDataVersion = useUtilsStore((s) => s.lenderDataVersion)
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState('')
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [graphType, setGraphType] = useState<GraphType>('team_new_users')
  const [checkedTeamIds, setCheckedTeamIds] = useState<Set<number>>(new Set())
  const [querying, setQuerying] = useState(0)
  const [graphError, setGraphError] = useState('')
  const inFlight = useRef(new Set<string>())
  const [teamData, setTeamData] = useState<Record<GraphType, TeamSeriesMap>>({
    team_new_users: {},
    team_loan_count: {},
  })

  useEffect(() => {
    if (!lenderId) {
      setTeams([])
      setCheckedTeamIds(new Set())
      setError('')
      return
    }

    setError('')
    setLoadingTeams(true)
    setCheckedTeamIds(new Set())
    setTeamData({
      team_new_users: {},
      team_loan_count: {},
    })
    new LenderTeams(lenderId)
      .start()
      .then((loadedTeams) => {
        setTeams(loadedTeams as Team[])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('failed_load_teams'))
      })
      .finally(() => {
        setLoadingTeams(false)
      })
  }, [lenderDataVersion, lenderId, t])

  useEffect(() => {
    // Track in-flight requests across effect re-runs (the effect re-fires on
    // every teamData update) so a team is fetched and counted exactly once.
    const missingIds = Array.from(checkedTeamIds).filter(
      (teamId) =>
        !teamData[graphType][teamId] && !inFlight.current.has(`${graphType}:${teamId}`),
    )
    if (!missingIds.length) return

    setQuerying((count) => count + missingIds.length)

    missingIds.forEach((teamId) => {
      const flightKey = `${graphType}:${teamId}`
      inFlight.current.add(flightKey)
      req.kiva.ajax
        .get('getGraphData', { graphName: graphType, id: teamId })
        .then((result) => {
          const sorted = ((result?.graphData ?? []) as Array<[string, number]>)
            .map(([x, y]) => [parseInt(x, 10), Number(y)] as [number, number])
            .sort((a, b) => a[0] - b[0])
            .filter((point, index, arr) => {
              if (index === 0 || index === arr.length - 1) return true
              const prev = arr[index - 1][1]
              const curr = point[1]
              const next = arr[index + 1][1]
              const avg = (prev + next) / 2
              return avg === 0 || curr >= avg * 0.4
            })

          setGraphError('')
          setTeamData((prev) => ({
            ...prev,
            [graphType]: {
              ...prev[graphType],
              [teamId]: sorted,
            },
          }))
        })
        .catch((err) => {
          // Scope graph-fetch failures to the chart pane; never unmount the page.
          setGraphError(err instanceof Error ? err.message : t('failed_load_team_graph_data'))
        })
        .finally(() => {
          inFlight.current.delete(flightKey)
          setQuerying((count) => Math.max(0, count - 1))
        })
    })
  }, [checkedTeamIds, graphType, teamData, t])

  const toggleTeam = useCallback((teamId: number) => {
    setCheckedTeamIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) {
        next.delete(teamId)
      } else {
        next.add(teamId)
      }
      return next
    })
  }, [])

  const chartData = useMemo(() => {
    const ids = Array.from(checkedTeamIds)
    if (!ids.length) return []

    const xValues = Array.from(
      new Set(
        ids.flatMap((teamId) => (teamData[graphType][teamId] ?? []).map(([x]) => x)),
      ),
    ).sort((a, b) => a - b)

    return xValues.map((x) => {
      const row: Record<string, number | string> = {
        x,
        label: formatXAxisLabel(x, locale),
      }
      ids.forEach((teamId) => {
        const point = (teamData[graphType][teamId] ?? []).find(([px]) => px === x)
        const team = teams.find((t) => t.id === teamId)
        if (team && point) {
          row[team.name] = point[1]
        }
      })
      return row
    })
  }, [checkedTeamIds, graphType, teamData, teams, locale])

  if (!lenderId) {
    return (
      <Container className="py-3">
        <LenderIdPitch
          title={t('pitch_teams_title')}
          onBeforeOpen={() => {
            reloadAfterLenderSet.current = true
          }}
        >
          {t('pitch_teams_body')}
        </LenderIdPitch>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="py-3">
        <Alert variant="danger">{error}</Alert>
      </Container>
    )
  }

  return (
    <Container className="py-3">
      <h1>{t('compare_teams')}</h1>
      <p>{t('select_teams_compare_graphs_appear')}</p>
      <Row>
        <Col sm={4}>
          <Card className="mb-3">
            <Card.Header>{t('compare')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="radio"
                name="graph_type"
                label={t('membership')}
                value="team_new_users"
                checked={graphType === 'team_new_users'}
                onChange={() => setGraphType('team_new_users')}
              />
              <Form.Check
                type="radio"
                name="graph_type"
                label={t('loan_count')}
                value="team_loan_count"
                checked={graphType === 'team_loan_count'}
                onChange={() => setGraphType('team_loan_count')}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
               {t('teams_2')}
              {querying > 0 ? ` — ${t('waiting_count_results_ellipsis', { count: querying })}` : ''}
              {!querying && loadingTeams ? ` — ${t('loading_teams_ellipsis')}` : ''}
            </Card.Header>
            <Card.Body>
              {teams.length === 0 && !loadingTeams && (
                <p className="text-muted">{t('no_teams_loaded_yet')}</p>
              )}
              <ul className="list-unstyled">
                {teams.map((team) => (
                  <li key={team.id}>
                    <Form.Check
                      type="checkbox"
                      label={team.name}
                      checked={checkedTeamIds.has(team.id)}
                      onChange={() => toggleTeam(team.id)}
                    />
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </Col>

        <Col sm={8}>
          {graphError ? <Alert variant="danger">{graphError}</Alert> : null}
          {checkedTeamIds.size > 0 && chartData.length > 0 ? (
            <div style={{ height: 600 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                     tickFormatter={(value) => formatXAxisLabel(value, locale)}
                    minTickGap={24}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis />
                  <Tooltip
                     labelFormatter={(value) => formatTooltipLabel(Number(value), locale)}
                    formatter={(value) => number(value ?? 0)}
                  />
                  <Legend />
                  {Array.from(checkedTeamIds).map((teamId, index) => {
                    const team = teams.find((t) => t.id === teamId)
                    if (!team) return null
                    return (
                      <Line
                        key={teamId}
                        type="monotone"
                        dataKey={team.name}
                        stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : checkedTeamIds.size > 0 ? (
            <p className="text-muted">{t('loading_chart_data_selected_teams')}</p>
          ) : (
            <p className="text-muted">{t('select_teams_left_see_comparison')}</p>
          )}
        </Col>
      </Row>
    </Container>
  )
}
