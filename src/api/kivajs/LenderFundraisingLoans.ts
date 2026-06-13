import { LenderLoans } from './LenderLoans'
import type { OnProgress } from './PagedKiva'

class LenderStatusLoans extends LenderLoans {
  constructor(lenderId: string, options: Record<string, any> = {}) {
    super(lenderId, { ...options })
  }

  async start(onProgress?: OnProgress): Promise<any[]> {
    const loans = await super.start(onProgress)
    if (this.options.status) {
      return loans.filter((loan) => loan.status === this.options.status)
    }
    return loans
  }
}

export class LenderFundraisingLoans extends LenderStatusLoans {
  constructor(lenderId: string, options: Record<string, any> = {}) {
    super(lenderId, {
      ...options,
      status: 'fundraising',
      fundraising_only: true,
    })
  }

  continuePaging(loans: any[]): boolean {
    if (
      this.options.fundraising_only &&
      !loans.some((loan) => loan.status === 'fundraising')
    ) {
      const now = new Date()
      // Older loans may not have planned_expiration_date
      if (
        loans.every(
          (loan) =>
            !loan.planned_expiration_date ||
            new Date(loan.planned_expiration_date) < now
        )
      ) {
        return false
      }
    }
    return true
  }

  async ids(onProgress?: OnProgress): Promise<number[]> {
    const loans = await this.start(onProgress)
    return loans
      .filter((loan) => loan.status === 'fundraising')
      .map((loan) => loan.id)
  }
}
