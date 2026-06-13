import { formatDate, today, startOfNextMonth, clearTime, monthsBetween } from '../../lib/dateUtils'
import { groupBy, percentWhere } from '../../lib/arrayUtils'
// Types used implicitly via the loan/partner objects passed to processing methods
// import type { KivaLoan, Partner } from '../../types'

const commonUse = [
  'PURCHASE', 'FOR', 'AND', 'BUY', 'OTHER', 'HER', 'BUSINESS', 'SELL',
  'MORE', 'HIS', 'THE', 'PAY',
]
const commonDescr = [
  ...commonUse, 'THIS', 'ARE', 'SHE', 'THAT', 'HAS', 'LOAN', 'BE', 'OLD',
  'BEEN', 'YEARS', 'FROM', 'WITH', 'INCOME', 'WILL', 'HAVE',
]

const ageRegEx1 = /([2-9]\d)[ |-]years?[ |-](?:of age|old)/i
const ageRegEx2 = /(?:aged?|is) ([2-9]\d)/i

export const getAge = (text: string): number | null => {
  let ageMatch = ageRegEx1.exec(text)
  ageMatch = ageMatch || ageRegEx2.exec(text)
  return Array.isArray(ageMatch) && ageMatch.length === 2
    ? parseInt(ageMatch[1], 10)
    : null
}

export class ResultProcessors {
  static processLoans(loans: any[]): any[] {
    loans.forEach(ResultProcessors.processLoan)
    return loans
  }

  static unprocessLoans(loans: any[]): any[] {
    return loans.map(ResultProcessors.unprocessLoan)
  }

  static unprocessLoan(loan: any): any {
    const l = structuredClone(loan)
    for (const field of Object.keys(l)) {
      if (field.startsWith('kl_')) delete l[field]
    }
    l.kls_half_back = l.kls_half_back ? l.kls_half_back.toISOString() : null
    l.kls_75_back = l.kls_75_back ? l.kls_75_back.toISOString() : null
    l.kls_final_repayment = l.kls_final_repayment
      ? l.kls_final_repayment.toISOString()
      : null
    delete l.getPartner
    return l
  }

  static processLoanDescription(loan: any): void {
    const processText = (
      text: string | undefined,
      ignoreWords: string[]
    ): string[] => {
      if (text && text.length > 0) {
        const matches = text.match(/(\w+)/g)
        if (!Array.isArray(matches)) return []
        return [
          ...new Set(
            matches
              .filter((word) => word !== undefined && word.length > 2)
              .map((word) => word.toUpperCase())
              .filter((word) => !ignoreWords.includes(word))
          ),
        ]
      }
      return []
    }

    let processDescr = false
    let descrArr: string[] = []
    const descriptionText = loan.description?.texts?.en

    // On server first-pass, kls will be empty; description and use populated.
    // On client, kls populated but no description.
    if (descriptionText) {
      descrArr = processText(descriptionText, commonDescr)
      processDescr = true
      loan.kls_has_descr = true
    } else {
      loan.kls_has_descr = false
    }

    if (processDescr) {
      const useArr = processText(loan.use, commonUse)
      loan.kls_use_or_descr_arr = [...new Set([...useArr, ...descrArr])]
    } else {
      if (!loan.kls_use_or_descr_arr) {
        loan.kls_use_or_descr_arr = []
      }
    }

    if (!loan.kls_age) {
      loan.kls_age = getAge(descriptionText || '')
    }
  }

  static processLoan(loan: any): any {
    if (typeof loan !== 'object') {
      console.trace('processLoan received non-object')
      return
    }

    loan.kl_processed = new Date()
    loan.kl_name_arr = loan.name.toUpperCase().match(/(\w+)/g)
    loan.kl_posted_date = new Date(loan.posted_date)
    loan.kl_newest_sort = loan.kl_posted_date.getTime()
    loan.kl_posted_hours_ago = () =>
      (Date.now() - loan.kl_posted_date!.getTime()) / (60 * 60 * 1000)
    if (!loan.basket_amount) loan.basket_amount = 0
    if (!loan.funded_amount) loan.funded_amount = 0
    loan.kl_dollars_per_hour = () =>
      (loan.funded_amount + loan.basket_amount) / loan.kl_posted_hours_ago()
    loan.kl_still_needed = Math.max(
      loan.loan_amount - loan.funded_amount,
      0
    )
    loan.kl_percent_funded =
      (100 * (loan.funded_amount + loan.basket_amount)) / loan.loan_amount

    if (loan.tags) {
      loan.kls_tags = loan.tags.map((tag: any) =>
        tag.name.replace(/\s+/g, '')
      )
    }
    if (!loan.kls_tags) loan.kls_tags = []

    if (loan.kls) {
      // Replace what was stripped by the server before sending down
      loan.description = loan.description || {
        languages: ['en'],
        texts: { en: '' },
      }
      loan.status = loan.status || 'fundraising'
      const maleCount = loan.klb?.M || 0
      const femaleCount = loan.klb?.F || 0
      loan.borrowers = [
        ...Array.from({ length: maleCount }, () => ({
          gender: 'M',
          first_name: '...',
        })),
        ...Array.from({ length: femaleCount }, () => ({
          gender: 'F',
          first_name: '...',
        })),
      ]
      loan.borrower_count = loan.borrowers.length
      loan.kls = false
    }

    // Parse date strings from kl api
    if (typeof loan.kls_half_back === 'string') {
      loan.kls_half_back = new Date(loan.kls_half_back)
      loan.kls_75_back = new Date(loan.kls_75_back)
      loan.kls_final_repayment = new Date(loan.kls_final_repayment)
    }

    if (loan.description.texts) {
      // Detail result - full processing
      ResultProcessors.processLoanDescription(loan)

      loan.kl_planned_expiration_date = new Date(loan.planned_expiration_date)
      loan.kl_expiring_in_days = () =>
        (loan.kl_planned_expiration_date!.getTime() - Date.now()) /
        (24 * 60 * 60 * 1000)
      loan.kl_disbursal_in_days = () =>
        (new Date(loan.terms.disbursal_date).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000)

      loan.kl_percent_women = percentWhere(
        loan.borrowers,
        (b: any) => b.gender === 'F'
      )

      // REPAYMENT STUFF: START
      const amount50 = loan.loan_amount * 0.5
      const amount75 = loan.loan_amount * 0.75
      let runningTotal = 0
      loan.kl_repayments = []

      if (
        loan.terms.scheduled_payments &&
        loan.terms.scheduled_payments.length
      ) {
        // Group by due_date and sum amounts
        if (!loan.kls) {
          const groups = groupBy(
            loan.terms.scheduled_payments,
            (p: any) => p.due_date
          )
          loan.terms.scheduled_payments = groups.map((g) => ({
            due_date: g[0].due_date,
            amount: g.reduce((sum: number, p: any) => sum + p.amount, 0),
          }))
        }

        let repayments = loan.terms.scheduled_payments.map((p: any) => {
          const date = new Date(p.due_date)
          return {
            date,
            display: formatDate(date, 'MMM-yyyy'),
            amount: p.amount,
          }
        })

        // Merge payments that fall in the same display month
        const displayGroups = groupBy(repayments, (r: any) => r.display)
        repayments = displayGroups.map((g) => ({
          date: g[g.length - 1].date,
          display: g[0].display,
          amount: g.reduce((sum: number, r: any) => sum + r.amount, 0),
        }))

        // Fill in gaps for months with no payments
        const nextMonthStart = startOfNextMonth()
        let nextDate = clearTime(
          new Date(Math.min(nextMonthStart.getTime(), repayments[0].date.getTime()))
        )
        const lastDate = clearTime(
          new Date(repayments[repayments.length - 1].date.getTime())
        )

        while (nextDate <= lastDate) {
          const displayToTest = formatDate(nextDate, 'MMM-yyyy')
          const existing = repayments.find(
            (r: any) => r.display === displayToTest
          )
          if (!existing) {
            repayments.push({
              date: new Date(nextDate.getTime()),
              display: displayToTest,
              amount: 0,
            })
          }
          // Advance to 1st of next month
          nextDate = clearTime(
            new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 1)
          )
        }

        // Sort and skip leading zero-payment months
        repayments = repayments.toSorted(
          (a: any, b: any) => a.date.getTime() - b.date.getTime()
        )
        // skipWhile: remove leading entries where amount === 0
        const firstNonZero = repayments.findIndex(
          (p: any) => p.amount !== 0
        )
        if (firstNonZero > 0) {
          repayments = repayments.slice(firstNonZero)
        }
        loan.kl_repayments = repayments

        // Add running percentage and track 50%/75% milestones
        loan.kl_repayments.forEach((payment: any) => {
          runningTotal += payment.amount
          payment.percent = (runningTotal * 100) / loan.loan_amount
          if (!loan.kls_half_back && runningTotal >= amount50) {
            loan.kls_half_back = payment.date
            loan.kls_half_back_actual = parseFloat(
              ((runningTotal * 100) / loan.loan_amount).toFixed(2)
            )
          }
          if (!loan.kls_75_back && runningTotal >= amount75) {
            loan.kls_75_back = payment.date
            loan.kls_75_back_actual = parseFloat(
              ((runningTotal * 100) / loan.loan_amount).toFixed(2)
            )
          }
        })

        loan.kls_final_repayment = new Date(
          loan.terms.scheduled_payments[
            loan.terms.scheduled_payments.length - 1
          ].due_date
        )
        const todayDate = today()
        loan.kls_repaid_in = loan.kls_final_repayment
          ? monthsBetween(loan.kls_final_repayment, todayDate)
          : 0
      }
      // REPAYMENT STUFF: END

      // Memory clean up: delete all non-english descriptions
      if (loan.description.languages) {
        loan.description.languages
          .filter((lang: string) => lang !== 'en')
          .forEach((lang: string) => delete loan.description.texts[lang])
      }
      delete loan.terms.local_payments
      delete loan.terms.disbursal_currency
      delete loan.terms.disbursal_amount
      delete loan.terms.loan_amount

      if (!loan.partner_id) loan.partner_id = null

      // Memory clean up of borrower data
      if (loan.borrowers) {
        loan.borrowers
          .filter((b: any) => b.last_name === '')
          .forEach((b: any) => delete b.last_name)
      }
    }

    // Clean up unnecessary fields
    delete loan.tags
    delete loan.journal_totals
    delete loan.translator
    if (loan.location) {
      delete loan.location.geo
      delete loan.location.town
    }
    if (loan.image) {
      delete loan.image.template_id
    }
    if (!loan.bonus_credit_eligibility) delete loan.bonus_credit_eligibility

    return loan
  }

  static processPartners(partners: any[]): any[] {
    const regionsLu: Record<string, string> = {
      'North America': 'na',
      'Central America': 'ca',
      'South America': 'sa',
      Africa: 'af',
      Asia: 'as',
      'Middle East': 'me',
      'Eastern Europe': 'ee',
      'Western Europe': 'we',
      Antarctica: 'an',
      Oceania: 'oc',
    }
    partners.forEach((p) => {
      p.kl_sp = p.social_performance_strengths
        ? p.social_performance_strengths.map((sp: any) => sp.id)
        : []
      p.kl_regions = [
        ...new Set(p.countries.map((c: any) => regionsLu[c.region])),
      ]
      p.kl_years_on_kiva =
        (today().getTime() - new Date(p.start_date).getTime()) /
        (365.25 * 24 * 60 * 60000)
    })
    return partners
  }
}
