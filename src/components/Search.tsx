import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Container, Col, Row, Alert, ButtonGroup, Button } from '../ui'
import numeral from 'numeral'
import { useLoanStore, useUtilsStore, useCriteriaStore } from '../stores'
import { Criteria } from './Criteria'
import LoanListItem from './LoanListItem'
import Loan from './Loan'
import InfiniteList from './InfiniteList'
import LoadingLoansPanel from './LoadingLoansPanel'
import BulkAddModal from './BulkAddModal'
import { NoResultsHelp } from './NoResultsHelp'
import { WELCOME_PROMPT } from '../lib/askKivaLensWelcome'
import { showLenderIDModal } from '../lib/showLenderIdModal'

// ---------------------------------------------------------------------------
// Search page — criteria panel + loan list + detail area
// ---------------------------------------------------------------------------

export function Search() {
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const downloading = useLoanStore((s) => s.downloading)
  const secondaryStatus = useLoanStore((s) => s.secondaryStatus)
  const backgroundResyncState = useLoanStore((s) => s.backgroundResyncState)
  const loanCount = filteredLoans.length
  const totalFundraising = useLoanStore((s) => s.loanCount)
  const selectedId = useLoanStore((s) => s.selectedId)
  const setSelectedId = useLoanStore((s) => s.setSelectedId)
  const { id: routeLoanId } = useParams<{ id: string }>()
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)
  // Portfolio-exclusion reveal (T1.4): is "exclude loans I've funded" on, and
  // is the lender's funded-loan list still loading?
  const excludePortfolio = useCriteriaStore(
    (s) => s.lastKnown?.portfolio?.exclude_portfolio_loans === 'true',
  )
  const lenderLoansLoading = useLoanStore((s) => s.lenderLoansLoading)

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
        <Col md={listCol} data-aikl="results">
          <ButtonGroup className="top-only d-flex" style={{ marginBottom: 0 }}>
            <Button onClick={toggleCriteria} className="w-50">
              {showCriteria ? 'Hide Criteria' : 'Show Criteria'}
            </Button>
            <Button onClick={openBulkAdd} className="w-50" data-aikl="bulk-add">
              Bulk Add
            </Button>
          </ButtonGroup>

          {secondaryStatus ? (
            <Alert variant="warning" className="not-rounded" style={{ marginBottom: 0 }}>
              More loans are still loading. Carry on. {secondaryStatus}
            </Alert>
          ) : null}

          {backgroundResyncState === 'started' ? (
            <Alert variant="info" className="not-rounded" style={{ marginBottom: 0 }}>
              Continue using the site while the loans are refreshed...
            </Alert>
          ) : null}

          {excludePortfolio && lenderLoansLoading ? (
            <Alert variant="info" className="not-rounded" style={{ marginBottom: 0 }}>
              Hiding loans you&apos;ve already funded — still loading your
              portfolio. Results will update in a moment.
            </Alert>
          ) : null}

          {loanCount > 0 ? (
            <div className="loan-count-bar">
              Showing {numeral(loanCount).format('0,0')} of{' '}
              {numeral(totalFundraising).format('0,0')} fundraising loans
            </div>
          ) : null}

          {hasHadLoans && loanCount === 0 && !downloading ? <NoResultsHelp /> : null}

          <LoadingLoansPanel />
          <InfiniteList
            className="loan_list_container"
            items={filteredLoans}
            itemHeight={82}
            height={900}
            renderItem={(loan) => <LoanListItem key={loan.id} loan={loan} />}
          />
        </Col>

        {/* Loan detail panel / Welcome panel */}
        <Col md={detailCol} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)', borderLeft: '1px solid #ddd' }}>
          {selectedId ? (
            <Loan loanId={selectedId} />
          ) : (
            <div className="p-3">
              <h2 style={{ marginTop: 0, color: '#2C8C5E' }}>Welcome to KivaLens</h2>
              <h4>Quick Start</h4>
              <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Use the criteria on the left to filter loans</li>
                <li>Click a loan to review details and repayment info</li>
                <li>Click &quot;Lend&quot; on loans you like</li>
                <li>Go to Basket tab to transfer loans to Kiva</li>
              </ol>
              {aiServerEnabled ? (
                <button
                  type="button"
                  onClick={() =>
                    useUtilsStore
                      .getState()
                      .openAskKl(WELCOME_PROMPT)
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
                  Need help getting started? Chat with KivaLens AI
                </button>
              ) : null}
              {!hasLenderId ? (
                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: '#f0f8f4',
                    borderRadius: 6,
                    border: '1px solid #d4edda',
                  }}
                >
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      showLenderIDModal()
                    }}
                  >
                    Set your Lender ID
                  </a>{' '}
                  to hide loans you&apos;ve already funded and enable portfolio balancing.
                </div>
              ) : null}
              <div style={{ marginTop: 16 }}>
                <a href="#/about">Learn more</a>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  )
}

export default Search
