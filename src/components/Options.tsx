import { useState, useEffect, useCallback, useRef } from 'react'
import { Container, Card, Form, Button, Col, Row } from '../ui'
import { lsj } from '../lib/localStorage'
import { useUtilsStore } from '../stores'
import KivaImage from './KivaImage'
import CompanionCard from './CompanionCard'
import { companionEnabled } from '../api/companion'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n'
import { applyThemeChoice, readThemeChoice, saveThemeChoice, type ThemeChoice } from '../lib/theme'
import { DEFAULT_LIMITS, sanitizeLimits } from '../lib/basketMix'

interface OptionsState {
  default_lend_amount: number
  hide_criteria_graphs: boolean
  mergeAtheistList: boolean
  debugging: boolean
  betaTester: boolean
  loansFromKiva: boolean
  maxRepaymentTerms: number
  maxRepaymentTerms_on: boolean
  basket_partner_limit: number
  basket_country_limit: number
}

const LEND_AMOUNTS = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

function basketLimitsOf(saved: Partial<OptionsState>) {
  const limits = sanitizeLimits(saved)
  return { basket_partner_limit: limits.partner, basket_country_limit: limits.country }
}

/**
 * A whole number of at least 1. The field keeps what the lender typed while it is
 * not one yet (an emptied box on the way to a new number); only a valid number is
 * saved, and leaving the field puts back the saved one.
 */
function LimitField({
  id,
  label,
  value,
  fallback,
  onSave,
}: {
  id: string
  label: string
  value: number
  fallback: number
  onSave: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Form.Group className="mb-3">
      <Form.Label htmlFor={id}>{label}</Form.Label>
      <div>
        <Form.Control
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder={String(fallback)}
          style={{ width: 110 }}
          value={draft ?? String(value)}
          onChange={(e) => {
            const text = e.target.value
            setDraft(text)
            const n = Number(text)
            if (text.trim() !== '' && Number.isInteger(n) && n >= 1) onSave(n)
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </Form.Group>
  )
}

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
      ...basketLimitsOf(saved),
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
  const { t, tx, relativeTime } = useI18n()
  const [opts, setOpts] = usePersistedOptions()
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readThemeChoice)
  const chooseTheme = (choice: ThemeChoice) => {
    setThemeChoice(choice)
    saveThemeChoice(choice)
    applyThemeChoice(choice)
  }
  const lenderObj = useUtilsStore((s) => s.lenderObj)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const fetchLenderObj = useUtilsStore((s) => s.fetchLenderObj)
  const openLenderIdModal = useUtilsStore((s) => s.openLenderIdModal)
  const setLenderId = useUtilsStore((s) => s.setLenderId)
  // Clearing unmounts the button that did it, which would drop focus to the top of the
  // page; send it to what takes its place. Covers clearing from the dialog too.
  const hadLenderId = useRef(Boolean(lenderId))
  useEffect(() => {
    const had = hadLenderId.current
    hadLenderId.current = Boolean(lenderId)
    if (!had || lenderId) return
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-kl-set-lender-id]')?.focus())
  }, [lenderId])
  const aiWidgetDisabled = useUtilsStore((s) => s.aiWidgetDisabled)
  const setAiWidgetDisabled = useUtilsStore((s) => s.setAiWidgetDisabled)

  useEffect(() => {
    if (lenderId && !lenderObj) {
      void fetchLenderObj(lenderId, false)
    }
  }, [fetchLenderObj, lenderId, lenderObj])

  // The basket's "Change this in Options" lands on its card (/options#basket-warnings).
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (!target) return
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' })
      target.focus({ preventScroll: true })
    })
  }, [hash])

  return (
    <Container className="py-3">
      <h1>{t('options')}</h1>
      <Row>
        <Col md={12}>
          {/* --- Who Are You --- */}
          <Card className="mb-3">
            <Card.Header>{t('who')}</Card.Header>
            <Card.Body>
              {lenderId ? (
                <p>
                  {t('lender_id')}: <b>{lenderId}</b>{' '}
                  <Button variant="link" size="sm" onClick={openLenderIdModal}>
                    {t('change')}
                  </Button>
                  {/* Setting an ID was a one-way door: nothing in the app took it back. */}
                  <Button variant="link" size="sm" onClick={() => setLenderId('')} aria-label={t('clear_lender_id')}>
                    {t('clear')}
                  </Button>
                </p>
              ) : (
                <Button data-kl-set-lender-id onClick={openLenderIdModal}>{t('set_kiva_lender_id')}</Button>
              )}

              <p className="ample-padding-top">{t('lender_id_enables')}</p>
              <ul className="spacedList">
                <li>{t('exclude_loans_ive_made_hides')}</li>
                <li>{t('portfolio_balancing_filter_partners')}</li>
                <li>{t('basket_pruning_automatically_removes')}</li>
                <li>{t('team_comparison_compare_membership')}</li>
                <li>{t('3d_loan_wall_visualize_portfolio')}</li>
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
                      <dt className="col-sm-4">{t('name')}</dt>
                      <dd className="col-sm-8">{lenderObj.name}</dd>

                      <dt className="col-sm-4">{t('loan_count')}</dt>
                      <dd className="col-sm-8">{lenderObj.loan_count ?? 0}</dd>

                      <dt className="col-sm-4">{t('invitees')}</dt>
                      <dd className="col-sm-8">{lenderObj.invitee_count ?? 0}</dd>

                      <dt className="col-sm-4">{t('invitation_link')}</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}
                        </a>
                      </dd>

                      <dt className="col-sm-4">{t('joined')}</dt>
                      <dd className="col-sm-8">
                         {lenderObj.member_since ? relativeTime(lenderObj.member_since) : t('unknown')}
                      </dd>

                      <dt className="col-sm-4">{t('location')}</dt>
                      <dd className="col-sm-8">{lenderObj.whereabouts ?? t('unknown')}</dd>

                      <dt className="col-sm-4">{t('lender_page')}</dt>
                      <dd className="col-sm-8">
                        <a
                          href={`https://www.kiva.org/lender/${lenderObj.lender_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                           {t('lender_page_2')}
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
            <Card.Header>{t('display')}</Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="kl-appearance">{t('appearance')}</Form.Label>
                <div>
                  <select
                    id="kl-appearance"
                    value={themeChoice}
                    onChange={(e) => chooseTheme(e.target.value as ThemeChoice)}
                    style={{ padding: '4px 8px', fontSize: 14, borderRadius: 4, border: '1px solid var(--kl-border-strong)', background: 'var(--kl-input-bg)', color: 'var(--kl-text)' }}
                  >
                    <option value="system">{t('appearance_match_device')}</option>
                    <option value="light">{t('appearance_light')}</option>
                    <option value="dark">{t('appearance_dark')}</option>
                  </select>
                </div>
                <Form.Text className="text-muted">{t('appearance_help')}</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>{t('default_lending_amount')}</Form.Label>
                <div>
                  <select
                    value={opts.default_lend_amount}
                    onChange={(e) => setOpts({ default_lend_amount: parseInt(e.target.value, 10) })}
                    style={{ padding: '4px 8px', fontSize: 14, borderRadius: 4, border: '1px solid var(--kl-border-strong)', background: 'var(--kl-input-bg)', color: 'var(--kl-text)' }}
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
                label={t('show_distribution_graphs_when_selecting')}
                checked={!opts.hide_criteria_graphs}
                onChange={(e) => setOpts({ hide_criteria_graphs: !e.target.checked })}
              />
            </Card.Body>
          </Card>

          {/* --- Basket warnings (the basket page's concentration checks) --- */}
          <Card className="mb-3" id="basket-warnings" tabIndex={-1}>
            <Card.Header>{t('basket_warnings')}</Card.Header>
            <Card.Body>
              <LimitField
                id="kl-basket-partner-limit"
                label={t('basket_partner_limit_label')}
                value={opts.basket_partner_limit}
                fallback={DEFAULT_LIMITS.partner}
                onSave={(n) => setOpts({ basket_partner_limit: n })}
              />
              <LimitField
                id="kl-basket-country-limit"
                label={t('basket_country_limit_label')}
                value={opts.basket_country_limit}
                fallback={DEFAULT_LIMITS.country}
                onSave={(n) => setOpts({ basket_country_limit: n })}
              />
              <Form.Text className="text-muted">{t('basket_warnings_help')}</Form.Text>
            </Card.Body>
          </Card>

          {/* --- External Research --- */}
          <Card className="mb-3">
            <Card.Header>{t('external_research')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                label={t('merge_teams_mfi_research_data')}
                checked
                disabled
                readOnly
              />
              <p className="mt-2">
                {tx('research_credit_aplus_data', {
                  aplus: <a href="https://www.kiva.org/team/aplus" target="_blank" rel="noreferrer">A+ Team</a>,
                  doc: (
                    <a
                      href="https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/edit#gid=1"
                      target="_blank"
                      rel="noreferrer"
                      title={t('view_google_doc')}
                    >
                      {t('google_doc')}
                    </a>
                  ),
                })}{' '}
                {t('adds_secular_social_score_sliders')}
              </p>
            </Card.Body>
          </Card>

          {/* --- Auto-Lending --- */}
          <Card className="mb-3">
            <Card.Header>{t('auto_lending')}</Card.Header>
            <Card.Body>
              <p className="mb-2">{t('use_page_set_kiva_preferences')}</p>
              <Link to="/autolend">{t('set_auto_lending_options_kiva')}</Link>
            </Card.Body>
          </Card>

          {/* --- Debug / Beta --- */}
          <Card className="mb-3">
            <Card.Header>{t('debug_beta_testing')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t('show_me_features_being_beta_tested')}
                checked={opts.betaTester}
                onChange={(e) => setOpts({ betaTester: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t('download_loans_kivas_server_instead')}
                checked={opts.loansFromKiva}
                onChange={(e) => setOpts({ loansFromKiva: e.target.checked })}
              />
              <Form.Check
                type="checkbox"
                className="mb-2"
                label={t('output_debugging_messages_console')}
                checked={opts.debugging}
                onChange={(e) => setOpts({ debugging: e.target.checked })}
              />
            </Card.Body>
          </Card>

          {/* --- AI Assistant --- */}
          <Card className="mb-3">
            <Card.Header>{t('ai_assistant')}</Card.Header>
            <Card.Body>
              <Form.Check
                type="checkbox"
                label={t('show_ask_kivalens_ai_assistant')}
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
