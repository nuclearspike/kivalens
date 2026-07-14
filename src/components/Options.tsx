import { useState, useEffect, useCallback } from 'react'
import { Container, Card, Form, Button, Col, Row } from '../ui'
import { lsj } from '../lib/localStorage'
import { useUtilsStore } from '../stores'
import KivaImage from './KivaImage'
import CompanionCard from './CompanionCard'
import { companionEnabled } from '../api/companion'
import { useI18n } from '../i18n'

interface OptionsState {
  default_lend_amount: number
  hide_criteria_graphs: boolean
  mergeAtheistList: boolean
  debugging: boolean
  betaTester: boolean
  loansFromKiva: boolean
  maxRepaymentTerms: number
  maxRepaymentTerms_on: boolean
}

const LEND_AMOUNTS = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

function usePersistedOptions(): [OptionsState, (patch: Partial<OptionsState>) => void] {
  const [state, setState] = useState<OptionsState>(() => {
    const saved = lsj.get<Partial<OptionsState>>('Options')
    return {
      default_lend_amount: saved.default_lend_amount ?? 25,
      hide_criteria_graphs: saved.hide_criteria_graphs ?? false,
      mergeAtheistList: saved.mergeAtheistList ?? true,
      debugging: saved.debugging ?? false,
      betaTester: saved.betaTester ?? false,
      loansFromKiva: saved.loansFromKiva ?? false,
      maxRepaymentTerms: saved.maxRepaymentTerms ?? 8,
      maxRepaymentTerms_on: saved.maxRepaymentTerms_on ?? false,
    }
  })

  const update = useCallback((patch: Partial<OptionsState>) => {
    setState((prev) => ({ ...prev, ...patch }))
    // Merge only the changed fields so unmanaged legacy keys (the lender id, now
    // owned by utilsStore) are preserved in the Options blob.
    lsj.setMerge('Options', patch)
  }, [])

  return [state, update]
}

export default function Options() {
  const { t, relativeTime } = useI18n()
  const [opts, setOpts] = usePersistedOptions()
  const lenderObj = useUtilsStore((s) => s.lenderObj)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const fetchLenderObj = useUtilsStore((s) => s.fetchLenderObj)
  const openLenderIdModal = useUtilsStore((s) => s.openLenderIdModal)
  const aiWidgetDisabled = useUtilsStore((s) => s.aiWidgetDisabled)
  const setAiWidgetDisabled = useUtilsStore((s) => s.setAiWidgetDisabled)

  useEffect(() => {
    if (lenderId && !lenderObj) {
      void fetchLenderObj(lenderId, false)
    }
  }, [fetchLenderObj, lenderId, lenderObj])

  return (
    <Container className="py-3">
      <h1>{t('Options')}</h1>
      <Row>
        <Col md={12}>
          {/* --- Who Are You --- */}
          <Card className="mb-3">
            <Card.Header>{t('Who are you?')}</Card.Header>
            <Card.Body>
              {lenderId ? (
                <p>
                  {t('Your Lender ID')}: <b>{lenderId}</b>{' '}
                  <Button variant="link" size="sm" onClick={openLenderIdModal}>
                    {t('Change')}
                  </Button>
                </p>
              ) : (
                <Button onClick={openLenderIdModal}>{t('Set Kiva Lender ID')}</Button>
              )}

              <p className="ample-padding-top">{t('Your Lender ID enables:')}</p>
              <ul className="spacedList">
                <li>{t("Exclude Loans I've Made: Hides loans you've already funded so you don't accidentally lend twice to the same borrower.")}</li>
                <li>{t('Portfolio Balancing: Filter by Partners, Countries, Sectors, and Activities relative to your existing portfolio.')}</li>
                <li>{t('Basket Pruning: Automatically removes completed loans from your basket when you return to KivaLens.')}</li>
                <li>{t('Team Comparison: Compare membership and lending across all your teams.')}</li>
                <li>{t('3D Loan Wall: Visualize your portfolio on the Wall page.')}</li>
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
                      <dt className="col-sm-4">{t('Name')}</dt>
                      <dd className="col-sm-8">{lenderObj.name}</dd>

                      <dt className="col-sm-4">{t('Loan Count')}</dt>
                      <dd className="col-sm-8">{lenderObj.loan_count ?? 0}</dd>

                      <dt className="col-sm-4">{t('Invitees')}</dt>
                      <dd className="col-sm-8">{lenderObj.invitee_count ?? 0}</dd>

                      <dt className="col-sm-4">{t('Invitation Link')}</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                        </a>
                      </dd>

                      <dt className="col-sm-4">{t('Joined')}</dt>
                      <dd className="col-sm-8">
                         {lenderObj.member_since ? relativeTime(lenderObj.member_since) : t('(unknown)')}
                      </dd>

                      <dt className="col-sm-4">{t('Location')}</dt>
                      <dd className="col-sm-8">{lenderObj.whereabouts ?? t('(unknown)')}</dd>

                      <dt className="col-sm-4">{t('Lender Page')}</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/lender/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                           {t('Your Lender Page')}
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
            <Card.Header>{t('Display')}</Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>{t('Default Lending Amount')}</Form.Label>
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
                label={t('Show distribution graphs when selecting criteria options')}
                checked={!opts.hide_criteria_graphs}
                onChange={(e) => setOpts({ hide_criteria_graphs: !e.target.checked })}
              />
            </Card.Body>
          </Card>

          {/* --- External Research --- */}
          <Card className="mb-3">
            <Card.Header>{t('External Research')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                label={t("Merge A+ Team's MFI Research Data for Secular, Social, and Religion ratings")}
                checked
                disabled
                readOnly
              />
              <p className="mt-2">
                {t('KivaLens combines field-partner research from the')}{' '}
                <a href="https://www.kiva.org/team/aplus" target="_blank" rel="noreferrer">A+ Team</a>{' '}
                {t('with data from')}{' '}
                <a
                  href="https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/edit#gid=1"
                  target="_blank"
                  rel="noreferrer"
                  title={t('View Google Doc')}
                >
                  {t('this Google Doc')}
                </a>.{' '}
                {t('This adds Secular and Social score sliders, a Religion filter, and rating details on partner pages. A score of 1 is low; for the Secular score, it indicates a religion-based organization. Partners absent from the research remain in results by default.')}
              </p>
            </Card.Body>
          </Card>

          {/* --- Debug / Beta --- */}
          <Card className="mb-3">
            <Card.Header>{t('Debug / Beta Testing')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t('Show me features that are being beta-tested')}
                checked={opts.betaTester}
                onChange={(e) => setOpts({ betaTester: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t("Download loans from Kiva's server instead of KivaLens (slower, use only if experiencing problems)")}
                checked={opts.loansFromKiva}
                onChange={(e) => setOpts({ loansFromKiva: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t('Output debugging messages to the console')}
                checked={opts.debugging}
                onChange={(e) => setOpts({ debugging: e.target.checked })}
              />
            </Card.Body>
          </Card>

          {/* --- AI Assistant --- */}
          <Card className="mb-3">
            <Card.Header>{t('AI Assistant')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                label={t('Show the Ask KivaLens AI assistant (the chat bubble in the corner)')}
                checked={!aiWidgetDisabled}
                onChange={(e) => setAiWidgetDisabled(!e.target.checked)}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}
