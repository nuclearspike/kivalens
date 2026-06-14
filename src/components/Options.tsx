import { useState, useEffect, useCallback } from 'react'
import { Container, Card, Form, Button, Col, Row } from '../ui'
import { formatDistanceToNow } from 'date-fns'
import { lsj } from '../lib/localStorage'
import { useUtilsStore } from '../stores'
import KivaImage from './KivaImage'
import CompanionCard from './CompanionCard'
import { companionEnabled } from '../api/companion'

interface OptionsState {
  kiva_lender_id: string
  default_lend_amount: number
  hide_criteria_graphs: boolean
  mergeAtheistList: boolean
  debugging: boolean
  betaTester: boolean
  loansFromKiva: boolean
  lenderLoansFromKiva: boolean
  maxRepaymentTerms: number
  maxRepaymentTerms_on: boolean
}

const LEND_AMOUNTS = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

function usePersistedOptions(): [OptionsState, (patch: Partial<OptionsState>) => void] {
  const [state, setState] = useState<OptionsState>(() => {
    const saved = lsj.get<Partial<OptionsState>>('Options')
    return {
      kiva_lender_id: saved.kiva_lender_id ?? '',
      default_lend_amount: saved.default_lend_amount ?? 25,
      hide_criteria_graphs: saved.hide_criteria_graphs ?? false,
      mergeAtheistList: saved.mergeAtheistList ?? true,
      debugging: saved.debugging ?? false,
      betaTester: saved.betaTester ?? false,
      loansFromKiva: saved.loansFromKiva ?? false,
      lenderLoansFromKiva: saved.lenderLoansFromKiva ?? false,
      maxRepaymentTerms: saved.maxRepaymentTerms ?? 8,
      maxRepaymentTerms_on: saved.maxRepaymentTerms_on ?? false,
    }
  })

  const update = useCallback((patch: Partial<OptionsState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      lsj.set('Options', next)
      return next
    })
  }, [])

  return [state, update]
}

export default function Options() {
  const [opts, setOpts] = usePersistedOptions()
  const lenderObj = useUtilsStore((s) => s.lenderObj)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const fetchLenderObj = useUtilsStore((s) => s.fetchLenderObj)
  const openLenderIdModal = useUtilsStore((s) => s.openLenderIdModal)

  // Sync external localStorage changes (e.g. from other tabs)
  useEffect(() => {
    const handler = () => {
      const saved = lsj.get<Partial<OptionsState>>('Options')
      if (saved.kiva_lender_id !== opts.kiva_lender_id) {
        setOpts({ kiva_lender_id: saved.kiva_lender_id ?? '' })
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [opts.kiva_lender_id, setOpts])

  useEffect(() => {
    if (lenderId && !lenderObj) {
      void fetchLenderObj(lenderId, false)
    }
  }, [fetchLenderObj, lenderId, lenderObj])

  return (
    <Container className="py-3">
      <h1>Options</h1>
      <Row>
        <Col md={12}>
          {/* --- Who Are You --- */}
          <Card className="mb-3">
            <Card.Header>Who are you?</Card.Header>
            <Card.Body>
              {opts.kiva_lender_id ? (
                <p>
                  Your Lender ID: <b>{opts.kiva_lender_id}</b>{' '}
                  <Button variant="link" size="sm" onClick={openLenderIdModal}>
                    Change
                  </Button>
                </p>
              ) : (
                <Button onClick={openLenderIdModal}>Set Kiva Lender ID</Button>
              )}

              <p className="ample-padding-top">Your Lender ID enables:</p>
              <ul className="spacedList">
                <li><b>Exclude Loans I&apos;ve Made:</b> Hides loans you&apos;ve already funded so you don&apos;t accidentally lend twice to the same borrower.</li>
                <li><b>Portfolio Balancing:</b> Filter by Partners, Countries, Sectors, and Activities relative to your existing portfolio.</li>
                <li><b>Basket Pruning:</b> Automatically removes completed loans from your basket when you return to KivaLens.</li>
                <li><b>Team Comparison:</b> Compare membership and lending across all your teams.</li>
                <li><b>3D Loan Wall:</b> Visualize your portfolio at <a href="#/portfolio">wall</a>.</li>
              </ul>

              {lenderObj ? (
                <Row className="g-3 align-items-start pt-2">
                  <Col sm={3} md={2}>
                    <KivaImage
                      type="square"
                      image_id={lenderObj.image?.id}
                      image_width={113}
                      width={113}
                      height={113}
                    />
                  </Col>
                  <Col sm={9} md={10}>
                    <dl className="row mb-0">
                      <dt className="col-sm-4">Name</dt>
                      <dd className="col-sm-8">{lenderObj.name}</dd>

                      <dt className="col-sm-4">Loan Count</dt>
                      <dd className="col-sm-8">{lenderObj.loan_count ?? 0}</dd>

                      <dt className="col-sm-4">Invitees</dt>
                      <dd className="col-sm-8">{lenderObj.invitee_count ?? 0}</dd>

                      <dt className="col-sm-4">Invitation Link</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                        </a>
                      </dd>

                      <dt className="col-sm-4">Joined</dt>
                      <dd className="col-sm-8">
                        {lenderObj.member_since
                          ? formatDistanceToNow(new Date(lenderObj.member_since), {
                              addSuffix: true,
                            })
                          : '(unknown)'}
                      </dd>

                      <dt className="col-sm-4">Location</dt>
                      <dd className="col-sm-8">{lenderObj.whereabouts ?? '(unknown)'}</dd>

                      <dt className="col-sm-4">Lender Page</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/lender/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Your Lender Page
                        </a>
                      </dd>
                    </dl>
                  </Col>
                </Row>
              ) : null}
            </Card.Body>
          </Card>

          {/* --- KivaLens Companion extension (only when VITE_COMPANION_EXT_ID is set) --- */}
          {companionEnabled && <CompanionCard />}

          {/* --- Display --- */}
          <Card className="mb-3">
            <Card.Header>Display</Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>Default Lending Amount</Form.Label>
                <div>
                  <select
                    value={opts.default_lend_amount}
                    onChange={(e) => setOpts({ default_lend_amount: parseInt(e.target.value, 10) })}
                    style={{ padding: '4px 8px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
                  >
                    {LEND_AMOUNTS.map((amt) => (
                      <option key={amt} value={amt}>
                        ${amt}
                      </option>
                    ))}
                  </select>
                </div>
              </Form.Group>
              <Form.Check
                type="checkbox"
                label="Show distribution graphs when selecting criteria options"
                checked={!opts.hide_criteria_graphs}
                onChange={(e) => setOpts({ hide_criteria_graphs: !e.target.checked })}
              />
            </Card.Body>
          </Card>

          {/* --- External Research --- */}
          <Card className="mb-3">
            <Card.Header>External Research</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                label="Merge A+ Team's MFI Research Data for Secular, Social, and Religion ratings"
                checked
                disabled
                readOnly
              />
              <p className="mt-2">
                KivaLens pulls the{' '}
                <a href="https://www.kiva.org/team/aplus" target="_blank" rel="noreferrer">A+ Team</a>
                &apos;s (Atheists, Agnostics, Skeptics, Freethinkers, Secular Humanists and the
                Non-Religious) MFI List from{' '}
                <a
                  href="https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/edit#gid=1"
                  target="_blank"
                  rel="noreferrer"
                  title="View Google Doc"
                >
                  this Google Doc
                </a>{' '}
                and merges some of the data which allows you to search using their Secular (1-4) and
                Social ratings (1-4) where a 1 represents a low score, so a 1 in the Secular Score
                means that it is religion based. This adds 2 sliders to the Partner Criteria tab, a
                Religion filter, and an additional section displaying and explaining the ratings on
                the Partner tab of the loan. If a partner is not present in the MFI Research Data,
                by default, it will show up in the results.
              </p>
            </Card.Body>
          </Card>

          {/* --- Debug / Beta --- */}
          <Card className="mb-3">
            <Card.Header>Debug / Beta Testing</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                className="mb-2"
                label="Show me features that are being beta-tested"
                checked={opts.betaTester}
                onChange={(e) => setOpts({ betaTester: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label="Download lender portfolio loans from Kiva's server instead of KivaLens (slower, use only if experiencing problems)"
                checked={opts.lenderLoansFromKiva}
                onChange={(e) => setOpts({ lenderLoansFromKiva: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label="Download loans from Kiva's server instead of KivaLens (slower, use only if experiencing problems)"
                checked={opts.loansFromKiva}
                onChange={(e) => setOpts({ loansFromKiva: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label="Output debugging messages to the console"
                checked={opts.debugging}
                onChange={(e) => setOpts({ debugging: e.target.checked })}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
