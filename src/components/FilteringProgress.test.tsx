// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import FilteringProgress, { PortfolioLoansLoadingNotice } from './FilteringProgress'
import { useCriteriaStore, useLoanStore } from '../stores'
import {
  LENDER_LOANS_FILTER_DEPENDENCY,
  LOAN_DESCRIPTIONS_FILTER_DEPENDENCY,
  PORTFOLIO_BALANCER_FILTER_DEPENDENCY_PREFIX,
} from '../lib/filterReadiness'

const resetReadiness = () => {
  useCriteriaStore.setState({
    lastKnown: { loan: {}, partner: {}, portfolio: {} },
  })
  useLoanStore.setState({
    lenderLoansLoading: false,
    pendingFilterDependencies: [],
    // Not mid-download: while the loading panel is up it carries this line
    // itself, and the overlay stays out of its way.
    downloading: false,
  })
}

describe('FilteringProgress', () => {
  beforeEach(resetReadiness)
  afterEach(cleanup)

  it('stays hidden when pending data cannot affect the active criteria', () => {
    useLoanStore.setState({
      pendingFilterDependencies: [
        LENDER_LOANS_FILTER_DEPENDENCY,
        LOAN_DESCRIPTIONS_FILTER_DEPENDENCY,
      ],
    })

    render(<FilteringProgress />)

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('warns accessibly while funded-loan exclusion is incomplete', () => {
    useCriteriaStore.setState({
      lastKnown: {
        loan: {},
        partner: {},
        portfolio: { exclude_portfolio_loans: 'true' },
      },
    })
    useLoanStore.setState({
      pendingFilterDependencies: [LENDER_LOANS_FILTER_DEPENDENCY],
    })

    render(<FilteringProgress />)

    expect(screen.getByRole('status')).toHaveTextContent('your existing loans')
    expect(screen.getByRole('status')).toHaveTextContent('Finishing your loan filters')
    // It lies over the results rather than taking a row from them.
    expect(document.querySelector('.kl-filter-status')).toBeInTheDocument()
  })

  it('keeps its live region in the DOM before it has anything to say', () => {
    // A live region inserted together with its message is often not announced:
    // the reader was not yet watching it. It takes no layout either way.
    render(<FilteringProgress />)
    expect(document.querySelector('.kl-filter-status[aria-live="polite"]')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays out of the way while the loading panel is saying it instead', () => {
    useCriteriaStore.setState({
      lastKnown: { loan: {}, partner: {}, portfolio: { exclude_portfolio_loans: 'true' } },
    })
    useLoanStore.setState({
      pendingFilterDependencies: [LENDER_LOANS_FILTER_DEPENDENCY],
      downloading: true,
      downloadProgress: null,
      filteredLoans: [],
    })

    render(<FilteringProgress />)

    // Two notices for one wait, one of them pushing the page around, is the
    // thing being fixed.
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('identifies description and portfolio-balancer dependencies', () => {
    useCriteriaStore.setState({
      lastKnown: {
        loan: { use: 'farmer' },
        partner: {},
        portfolio: {},
      },
    })
    useLoanStore.setState({
      pendingFilterDependencies: [
        LOAN_DESCRIPTIONS_FILTER_DEPENDENCY,
        `${PORTFOLIO_BALANCER_FILTER_DEPENDENCY_PREFIX}pb_sector`,
      ],
    })

    render(<FilteringProgress />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('loan descriptions')
    expect(status).toHaveTextContent('portfolio balancing data')
  })
})

describe('PortfolioLoansLoadingNotice', () => {
  beforeEach(resetReadiness)
  afterEach(cleanup)

  it('shows on the portfolio tab whenever existing loans are downloading', () => {
    useLoanStore.setState({ lenderLoansLoading: true })

    render(<PortfolioLoansLoadingNotice />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your existing loans are still downloading',
    )
  })
})
