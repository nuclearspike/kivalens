import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Container, Col, Row, Alert, ButtonGroup, Button } from '../ui'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { Criteria } from './Criteria'
import LoanListItem from './LoanListItem'
import Loan from './Loan'
import InfiniteList from './InfiniteList'
import LoadingLoansPanel from './LoadingLoansPanel'
import FilteringProgress from './FilteringProgress'
import BulkAddModal from './BulkAddModal'
import { NoResultsHelp } from './NoResultsHelp'
import { WELCOME_PROMPT } from '../lib/askKivaLensWelcome'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { parseSearchPreset, parseSearchPresetTab } from '../lib/searchPreset'
import { useI18n } from '../i18n'
import { pluralCategory } from '../lib/pluralCategory'

// ---------------------------------------------------------------------------
// Search page — criteria panel + loan list + detail area
// ---------------------------------------------------------------------------

export function Search() {
  const { t, tx, number, locale } = useI18n()
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const downloading = useLoanStore((s) => s.downloading)
  const secondaryStatus = useLoanStore((s) => s.secondaryStatus)
  const backgroundResyncState = useLoanStore((s) => s.backgroundResyncState)
  const loanCount = filteredLoans.length
  const totalFundraising = useLoanStore((s) => s.loanCount)
  const countGaps = useLoanStore((s) => s.countGaps)
  // Loans left out by the MFI/Direct choice or by the already-lent filter, each
  // counted within every other criterion; only the ones that are not zero.
  const gapNotes = [
    countGaps.directNotShown > 0 && t(pluralCategory(locale, countGaps.directNotShown) === 'one' ? 'direct_loans_not_shown_one' : 'direct_loans_not_shown', { count: number(countGaps.directNotShown) }),
    countGaps.mfiNotShown > 0 && t(pluralCategory(locale, countGaps.mfiNotShown) === 'one' ? 'mfi_loans_not_shown_one' : 'mfi_loans_not_shown', { count: number(countGaps.mfiNotShown) }),
    countGaps.alreadyLentHidden > 0 && t(pluralCategory(locale, countGaps.alreadyLentHidden) === 'one' ? 'already_lent_hidden_one' : 'already_lent_hidden', { count: number(countGaps.alreadyLentHidden) }),
  ].filter(Boolean) as string[]
  const selectedId = useLoanStore((s) => s.selectedId)
  const setSelectedId = useLoanStore((s) => s.setSelectedId)
  const { id: routeLoanId } = useParams<{ id: string }>()
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)
  const aiWidgetDisabled = useUtilsStore((s) => s.aiWidgetDisabled)
  const [searchParams, setSearchParams] = useSearchParams()
  const presetHandled = useRef(false)

  // KivaLens Lite help can hand off a bounded, non-personal starting search.
  // Consume it exactly once, then remove it from the route so returning to Search
  // does not unexpectedly overwrite criteria the lender changed afterward.
  useEffect(() => {
    if (presetHandled.current) return
    const rawPreset = searchParams.get('preset')
    const rawTab = searchParams.get('tab')
    if (rawPreset === null && rawTab === null) return

    presetHandled.current = true
    const preset = parseSearchPreset(rawPreset)
    const tab = parseSearchPresetTab(rawTab)
    if (preset) useCriteriaStore.getState().setCriteria(preset)
    if (tab) useUtilsStore.getState().setAiCriteriaTab(tab)

    const remaining = new URLSearchParams(searchParams)
    remaining.delete('preset')
    remaining.delete('tab')
    setSearchParams(remaining, { replace: true })
  }, [searchParams, setSearchParams])

  // /search/loan/:id pre-selects the loan; plain /search shows the welcome
  // panel. The URL is the source of truth for the right-hand panel.
  useEffect(() => {
    setSelectedId(routeLoanId ? parseInt(routeLoanId, 10) : null)
  }, [routeLoanId, setSelectedId])

  const [showCriteria, setShowCriteria] = useState(true)
  const [hasHadLoans, setHasHadLoans] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)

  // "N loans" toast on every filter run, like the old react-notification bar
  const [notification, setNotification] = useState('')
  const firstFilterRun = useRef(true)
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false
      if (filteredLoans.length === 0) return
    }
    setNotification(`${filteredLoans.length} loans`)
    const timer = setTimeout(() => setNotification(''), 5000)
    return () => clearTimeout(timer)
  }, [filteredLoans])

  // Track whether we ever had results
  if (loanCount > 0 && !hasHadLoans) {
    setHasHadLoans(true)
  }

  const toggleCriteria = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setShowCriteria((v) => !v)
    },
    [],
  )

  const openBulkAdd = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setShowBulkAdd(true)
    },
    [],
  )

  // Column widths matching the old app's 4-3-5 grid
  const critCol = showCriteria ? 4 : 0
  const listCol = 3
  const detailCol = showCriteria ? 5 : 9

  return (
    <Container fluid className="px-2">
      {showBulkAdd ? <BulkAddModal onHide={() => setShowBulkAdd(false)} /> : null}
      {notification ? (
        <div className="notification-bar">
          <span className="notification-bar-message">{notification}</span>
        </div>
      ) : null}
      <Row>
        {/* Criteria panel */}
        {showCriteria && (
          <Col md={critCol} style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 60px)', paddingRight: 5 }}>
            <Criteria />
          </Col>
        )}

        {/* Loan list */}
        <Col md={listCol} data-aikl="results" className="results-col">
          <FilteringProgress />
          <ButtonGroup className="top-only d-flex" style={{ marginBottom: 0 }}>
            <Button onClick={toggleCriteria} className="w-50">
              {t(showCriteria ? 'hide_criteria' : 'show_criteria')}
            </Button>
            <Button onClick={openBulkAdd} className="w-50" data-aikl="bulk-add">
              {t('bulk_add')}
            </Button>
          </ButtonGroup>

          {secondaryStatus ? (
            <Alert variant="warning" className="not-rounded" style={{ marginBottom: 0 }}>
              {t('more_loans_still_loading_carry')} {secondaryStatus}
            </Alert>
          ) : null}

          {backgroundResyncState === 'started' ? (
            <Alert variant="info" className="not-rounded" style={{ marginBottom: 0 }}>
              {t('continue_using_site_while_loans')}
            </Alert>
          ) : null}

          {loanCount > 0 ? (
            <div className="loan-count-bar">
              {t('showing_shown_total_fundraising_loans', {
                shown: number(loanCount),
                total: number(totalFundraising),
              })}
              {gapNotes.length > 0 && <div className="kl-count-gaps">{gapNotes.join(' · ')}</div>}
            </div>
          ) : null}

          {hasHadLoans && loanCount === 0 && !downloading ? <NoResultsHelp /> : null}

          <LoadingLoansPanel />
          {/* No fixed height: the list flex-fills the column, which is capped to
              the viewport like its neighbours (see .results-col). */}
          <InfiniteList
            className="loan_list_container"
            items={filteredLoans}
            itemHeight={82}
            renderItem={(loan) => <LoanListItem key={loan.id} loan={loan} />}
          />
        </Col>

        {/* Loan detail panel / Welcome panel */}
        <Col md={detailCol} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)', borderLeft: '1px solid var(--kl-border)' }}>
          {selectedId ? (
            <Loan loanId={selectedId} />
          ) : (
            <div className="p-3">
              <h2 style={{ marginTop: 0, color: 'var(--kl-green-text)' }}>{t('welcome_kivalens')}</h2>
              <h4>{t('quick_start')}</h4>
              <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                <li>{t('use_criteria_left_filter_loans')}</li>
                <li>{t('click_loan_review_details_repayment')}</li>
                <li>{t('click_lend_loans_like')}</li>
                <li>{t('go_basket_tab_transfer_loans')}</li>
              </ol>
              {aiServerEnabled && !aiWidgetDisabled ? (
                <button
                  type="button"
                  onClick={() =>
                    useUtilsStore
                      .getState()
                      .openAskKl(t(WELCOME_PROMPT))
                  }
                  style={{
                    marginTop: 8,
                    background: 'var(--kl-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '10px 18px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('need_help_getting_started_chat')}
                </button>
              ) : null}
              {!hasLenderId ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: 'var(--kl-green-light)',
                    borderRadius: 6,
                    border: '1px solid var(--kl-green-border)',
                  }}
                >
                  {tx('set_lender_id_purpose', {
                    link: (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          showLenderIDModal()
                        }}
                      >
                        {t('set_lender_id_2')}
                      </a>
                    ),
                  })}
                </div>
              ) : null}
              <div style={{ marginTop: 16 }}>
                <a href="#/about">{t('learn_more')}</a>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  )
}

export default Search
