import { getKivaLoans } from '../api/kiva'
import { resolveBalancerValues } from '../../server/loanFilter.mjs'
import type { DescribeDeps, Translate } from './describeCriteria'

/**
 * What describeCriteria needs from this page's Kiva data: a field partner's name, and
 * how many slices a balancer hides or shows for the lender now, counted by the rule
 * the filter applies (resolveBalancerValues). Undefined while their portfolio has not
 * been read (reading it is asked for then, as the filter asks), or with no lender ID.
 */
export function kivaDescribeDeps(t: Translate, data: (english: string) => string): DescribeDeps {
  return {
    t,
    data,
    partnerName: (id) => getKivaLoans()?.getPartner(Number(id))?.name,
    balancerCount: (sliceBy, config) => {
      const slices = getKivaLoans()?.balancerSlices(sliceBy, config.allactive ?? 'all')
      return slices ? resolveBalancerValues(config, slices, sliceBy).length : undefined
    },
  }
}
