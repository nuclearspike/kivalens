import { PagedKiva } from './PagedKiva'

export class LenderLoans extends PagedKiva {
  override options: Record<string, any>

  constructor(lenderId: string, options: Record<string, any> = {}) {
    super(`lenders/${lenderId}/loans.json`, {}, 'loans')
    this.options = options
  }
}
