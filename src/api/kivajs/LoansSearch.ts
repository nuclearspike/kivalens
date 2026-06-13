import { PagedKiva } from './PagedKiva'
import type { OnProgress } from './PagedKiva'
import { ResultProcessors } from './ResultProcessors'
import { isAfter } from '../../lib/dateUtils'

export class LoansSearch extends PagedKiva {
  maxRepaymentDate: Date | null

  constructor(
    params: Record<string, any>,
    getDetails = true,
    maxRepaymentDate?: Date | null,
    preventVisitor?: boolean
  ) {
    const searchParams: Record<string, any> = {
      status: 'fundraising',
      ...params,
    }
    if (maxRepaymentDate) searchParams.sort_by = 'repayment_term'
    super('loans/search.json', searchParams, 'loans')
    this.maxRepaymentDate = maxRepaymentDate || null
    this.twoStage = getDetails
    if (!preventVisitor) this.visitorFunct = ResultProcessors.processLoan
  }

  continuePaging(loans: any[]): boolean {
    if (this.maxRepaymentDate) {
      // If all loans on the page won't repay until after the max, stop
      if (
        loans.every((loan) =>
          isAfter(loan.kls_final_repayment, this.maxRepaymentDate!)
        )
      ) {
        return false
      }
    }
    return true
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    const loans = await super.start(onProgress)
    return loans
  }
}
