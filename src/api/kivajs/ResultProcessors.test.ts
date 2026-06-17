import { describe, it, expect } from 'vitest'
import { ResultProcessors, getAge } from './ResultProcessors'

// ResultProcessors computes the kl_* "truths" the UI reveals (still-needed,
// percent-funded, repayment milestones, etc.). processLoan mutates in place.

describe('getAge', () => {
  it('extracts "NN years old"', () => {
    expect(getAge('She is 45 years old and sells fruit')).toBe(45)
  })
  it('extracts "aged NN"', () => {
    expect(getAge('A farmer, aged 30, from Kenya')).toBe(30)
  })
  it('returns null when no age is present', () => {
    expect(getAge('A hardworking entrepreneur')).toBeNull()
  })
})

describe('processLoan - core computed fields', () => {
  // description:{} (no .texts) keeps processLoan on the lightweight path.
  const baseLoan = () => ({
    id: 1,
    name: 'Maria Sells',
    posted_date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    loan_amount: 1000,
    funded_amount: 250,
    basket_amount: 50,
    status: 'fundraising',
    description: {},
  })

  it('computes kl_still_needed from funded vs total (basket ignored)', () => {
    const loan: any = ResultProcessors.processLoan(baseLoan())
    expect(loan.kl_still_needed).toBe(750)
  })

  it('computes kl_percent_funded including basket_amount', () => {
    const loan: any = ResultProcessors.processLoan(baseLoan())
    expect(loan.kl_percent_funded).toBe(30) // 100*(250+50)/1000
  })

  it('never reports negative still-needed', () => {
    const over: any = { ...baseLoan(), funded_amount: 1200 }
    const loan: any = ResultProcessors.processLoan(over)
    expect(loan.kl_still_needed).toBe(0)
  })

  it('defaults missing funded/basket amounts to 0', () => {
    const bare: any = {
      id: 2,
      name: 'No Amounts',
      posted_date: new Date().toISOString(),
      loan_amount: 500,
      status: 'fundraising',
      description: {},
    }
    const loan: any = ResultProcessors.processLoan(bare)
    expect(loan.funded_amount).toBe(0)
    expect(loan.basket_amount).toBe(0)
    expect(loan.kl_percent_funded).toBe(0)
    expect(loan.kl_still_needed).toBe(500)
  })

  it('splits the name into uppercased words and exposes a positive $/hr', () => {
    const loan: any = ResultProcessors.processLoan(baseLoan())
    expect(loan.kl_name_arr).toEqual(['MARIA', 'SELLS'])
    expect(typeof loan.kl_newest_sort).toBe('number')
    expect(loan.kl_dollars_per_hour()).toBeGreaterThan(0)
  })

  it('strips whitespace from tag names into kls_tags', () => {
    const tagged: any = { ...baseLoan(), tags: [{ name: '#Woman Owned' }, { name: 'Eco' }] }
    const loan: any = ResultProcessors.processLoan(tagged)
    expect(loan.kls_tags).toEqual(['#WomanOwned', 'Eco'])
  })

  it('defaults kls_tags to [] when there are no tags', () => {
    const loan: any = ResultProcessors.processLoan(baseLoan())
    expect(loan.kls_tags).toEqual([])
  })
})

describe('processLoan - detail path (repayment milestones)', () => {
  it('computes half-back / 75%-back milestone percentages and percent-women', () => {
    const loan: any = {
      id: 3,
      name: 'Ana',
      posted_date: new Date().toISOString(),
      loan_amount: 100,
      funded_amount: 0,
      basket_amount: 0,
      status: 'fundraising',
      planned_expiration_date: new Date(Date.now() + 10 * 864e5).toISOString(),
      description: { languages: ['en'], texts: { en: 'She is 45 years old and sells vegetables.' } },
      borrowers: [{ gender: 'F' }, { gender: 'M' }],
      terms: {
        disbursal_date: new Date().toISOString(),
        repayment_interval: 'monthly',
        scheduled_payments: [
          { due_date: '2027-01-15', amount: 50 },
          { due_date: '2027-02-15', amount: 50 },
        ],
      },
    }
    ResultProcessors.processLoan(loan)
    expect(loan.kls_age).toBe(45)
    expect(loan.kl_percent_women).toBe(50)
    expect(loan.kls_half_back_actual).toBe(50)
    expect(loan.kls_75_back_actual).toBe(100)
    expect(Array.isArray(loan.kl_repayments)).toBe(true)
    expect(loan.kls_use_or_descr_arr).toContain('VEGETABLES')
  })
})

describe('processPartners', () => {
  it('derives kl_sp, kl_regions, and a positive kl_years_on_kiva', () => {
    const partner: any = {
      social_performance_strengths: [{ id: '1' }, { id: 2 }],
      countries: [{ region: 'Africa' }, { region: 'Asia' }],
      start_date: new Date(Date.now() - 2 * 365.25 * 864e5).toISOString(),
    }
    ResultProcessors.processPartners([partner])
    expect(partner.kl_sp).toEqual(['1', 2])
    expect(partner.kl_regions).toEqual(['af', 'as'])
    expect(partner.kl_years_on_kiva).toBeGreaterThan(1)
    expect(partner.kl_years_on_kiva).toBeLessThan(3)
  })

  it('defaults kl_sp to [] when a partner has no strengths', () => {
    const partner: any = { countries: [{ region: 'Africa' }], start_date: new Date().toISOString() }
    ResultProcessors.processPartners([partner])
    expect(partner.kl_sp).toEqual([])
  })
})
