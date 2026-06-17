/**
 * kiva.ts - The heart of KivaLens.
 *
 * Port of the 1141-line kiva.js.  All downloading, filtering, sorting,
 * basket management, background resync, hot-loan checking and event
 * notification lives here.  This module is UI-framework-agnostic.
 *
 * Translations applied:
 *   jQuery Deferred  -> async/await + Promises + callback events
 *   linqjs           -> native array methods + arrayUtils helpers
 *   datejs           -> dateUtils helpers
 *   extend(true,…)   -> Object.assign / spread
 *   window.kivaloans -> singleton instance of this class
 */

import type {
  KivaLoan,
  Partner,
  Criteria,
  PartnerCriteria,
  PortfolioCriteria,
  ProgressEvent,
  RunningTotals,
} from '../types'
import { sortBy, distinct, groupBy } from '../lib/arrayUtils'
import { today } from '../lib/dateUtils'
import { cl, wait } from '../lib/utils'
import { setAPIOptions, getUrl } from './kivajs/kivaBase'
import { ResultProcessors } from './kivajs/ResultProcessors'
import { CritTester } from './kivajs/CritTester'
import { req } from './kivajs/req'
import { LoansSearch } from './kivajs/LoansSearch'
import { LoanBatch } from './kivajs/LoanBatch'
import { Partners } from './kivajs/Partners'
import { LenderFundraisingLoans } from './kivajs/LenderFundraisingLoans'
import { processPartnerReligions } from './kivajs/normalizeReligion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotifyMessage = {
  loan_load_progress?: ProgressEvent
  loans_loaded?: boolean
  all_descriptions_loaded?: boolean
  failed?: unknown
  loan_not_fundraising?: KivaLoan
  loan_updated?: KivaLoan
  running_totals_change?: RunningTotals
  lender_loans_event?: string
  new_loans?: KivaLoan[]
  atheist_list_loaded?: boolean
  backgroundResync?: { state: string }
  background_updated?: number
  secondary_load?: string
  secondary_load_label?: string
  [key: string]: unknown
}

export type NotifyCallback = (message: NotifyMessage) => void

interface KLApiStart {
  batch: number
  pages: number
  loanLengths: number[]
  descrLengths: number[]
}

const LenderLoansState = {
  Unknown: 0,
  Downloading: 1,
  Complete: 2,
} as const

// ---------------------------------------------------------------------------
// QueuedActions  - simple batching helper
// ---------------------------------------------------------------------------

interface QueuedActionsOptions {
  action: (items: any[]) => void
  isReady: () => boolean
  maxQueue: number
  waitFor: number
}

class QueuedActions {
  queue: any[] = []
  private intervalHandle = 0
  private action: (items: any[]) => void = () => {}
  private isReady: () => boolean = () => true
  private maxQueue = 10
  private waitForMs = 5000

  init(options: Partial<QueuedActionsOptions>): this {
    if (options.action) this.action = options.action
    if (options.isReady) this.isReady = options.isReady
    if (options.maxQueue !== undefined) this.maxQueue = options.maxQueue
    if (options.waitFor !== undefined) this.waitForMs = options.waitFor
    this.intervalHandle = window.setInterval(() => this.processQueue(), this.waitForMs)
    return this
  }

  processQueue(): void {
    if (!this.isReady() || !this.queue.length) return
    const batch = this.queue
    this.queue = []
    this.action(batch)
  }

  enqueue(objs: any | any[]): void {
    if (Array.isArray(objs)) {
      this.queue = Array.from(new Set([...this.queue, ...objs]))
    } else {
      this.queue.push(objs)
    }
    if (this.queue.length > this.maxQueue) {
      this.processQueue()
    }
  }

  destroy(): void {
    clearInterval(this.intervalHandle)
  }
}

// ---------------------------------------------------------------------------
// Default static data
// ---------------------------------------------------------------------------

export const defaultKivaData = {
  sectors: [
    'Agriculture', 'Arts', 'Clean Energy', 'Clothing', 'Construction', 'Education',
    'Entertainment', 'Food', 'Health', 'Housing', 'Manufacturing', 'Personal Use',
    'Retail', 'Reuse & Recycle', 'Sanitation & Hygiene', 'Services', 'Transportation',
    'Water', 'Wholesale',
  ],
  countries: [
    { code: 'AF', name: 'Afghanistan' }, { code: 'AM', name: 'Armenia' },
    { code: 'FJ', name: 'Fiji' }, { code: 'TO', name: 'Tonga' },
    { code: 'AZ', name: 'Azerbaijan' }, { code: 'BZ', name: 'Belize' },
    { code: 'BJ', name: 'Benin' }, { code: 'BO', name: 'Bolivia' },
    { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BR', name: 'Brazil' },
    { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
    { code: 'BI', name: 'Burundi' }, { code: 'KH', name: 'Cambodia' },
    { code: 'CM', name: 'Cameroon' }, { code: 'TD', name: 'Chad' },
    { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
    { code: 'CO', name: 'Colombia' }, { code: 'CG', name: 'Congo (Rep.)' },
    { code: 'CR', name: 'Costa Rica' }, { code: 'CI', name: "Cote D'Ivoire" },
    { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' },
    { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' },
    { code: 'GZ', name: 'Gaza' }, { code: 'GE', name: 'Georgia' },
    { code: 'GH', name: 'Ghana' }, { code: 'GU', name: 'Guam' },
    { code: 'GT', name: 'Guatemala' }, { code: 'HT', name: 'Haiti' },
    { code: 'HN', name: 'Honduras' }, { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' }, { code: 'IQ', name: 'Iraq' },
    { code: 'IL', name: 'Israel' }, { code: 'JO', name: 'Jordan' },
    { code: 'KE', name: 'Kenya' }, { code: 'XK', name: 'Kosovo' },
    { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Lao PDR' },
    { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
    { code: 'LR', name: 'Liberia' }, { code: 'MG', name: 'Madagascar' },
    { code: 'AL', name: 'Albania' }, { code: 'MW', name: 'Malawi' },
    { code: 'ML', name: 'Mali' }, { code: 'MR', name: 'Mauritania' },
    { code: 'MX', name: 'Mexico' }, { code: 'MD', name: 'Moldova' },
    { code: 'MN', name: 'Mongolia' }, { code: 'MZ', name: 'Mozambique' },
    { code: 'MM', name: 'Myanmar (Burma)' }, { code: 'NA', name: 'Namibia' },
    { code: 'NP', name: 'Nepal' }, { code: 'NI', name: 'Nicaragua' },
    { code: 'NG', name: 'Nigeria' }, { code: 'PK', name: 'Pakistan' },
    { code: 'PS', name: 'Palestine' }, { code: 'PA', name: 'Panama' },
    { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' },
    { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' },
    { code: 'RW', name: 'Rwanda' }, { code: 'VC', name: 'St Vincent' },
    { code: 'WS', name: 'Samoa' }, { code: 'SN', name: 'Senegal' },
    { code: 'SL', name: 'Sierra Leone' }, { code: 'SB', name: 'Solomon Islands' },
    { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' },
    { code: 'QS', name: 'South Sudan' }, { code: 'LK', name: 'Sri Lanka' },
    { code: 'SR', name: 'Suriname' }, { code: 'TJ', name: 'Tajikistan' },
    { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' },
    { code: 'CD', name: 'Congo (Dem. Rep.)' }, { code: 'TL', name: 'Timor-Leste' },
    { code: 'TG', name: 'Togo' }, { code: 'TR', name: 'Turkey' },
    { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
    { code: 'US', name: 'United States' }, { code: 'VU', name: 'Vanuatu' },
    { code: 'VN', name: 'Vietnam' }, { code: 'VI', name: 'Virgin Islands' },
    { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' },
  ].slice().sort((a, b) => a.name.localeCompare(b.name)),
}

// ---------------------------------------------------------------------------
// CSV parsing (for Atheist Team spreadsheet)
// ---------------------------------------------------------------------------

function csvToArray(strData: string): string[][] {
  const delimiter = ','
  const pattern = new RegExp(
    '(\\' + delimiter + '|\\r?\\n|\\r|^)' +
    '(?:"([^"]*(?:""[^"]*)*)"|' +
    '([^"\\' + delimiter + '\\r\\n]*))',
    'gi',
  )
  const arrData: string[][] = [[]]
  let matches: RegExpExecArray | null
  while ((matches = pattern.exec(strData))) {
    const matchedDelimiter = matches[1]
    if (matchedDelimiter.length && matchedDelimiter !== delimiter) {
      arrData.push([])
    }
    const value = matches[2] ? matches[2].replace(/""/g, '"') : matches[3]
    arrData[arrData.length - 1].push(value)
  }
  return arrData
}

function csvToPartnerScores(csv: string): Array<Record<string, string>> {
  const arr = csvToArray(csv)
  if (arr.length >= 1) {
    arr[0] = [
      'id', 'X', 'Name', 'Link', 'Country', 'Kiva Status', 'Default Rate',
      'Loans at Risk', 'Kiva Risk Rating (5 best)', 'secularRating',
      'religiousAffiliation', 'commentsOnSecularRating', 'socialRating',
      'commentsOnSocialRating', 'MFI Link', 'By', 'Date', 'reviewComments',
      'P', 'J', 'MFI Name', 'index', 'MFI Name Check',
    ]
  }
  const result: Array<Record<string, string>> = []
  for (let i = 1; i < arr.length; i++) {
    const obj: Record<string, string> = {}
    for (let k = 0; k < arr[0].length && k < arr[i].length; k++) {
      obj[arr[0][k]] = arr[i][k]
    }
    result.push(obj)
  }
  return result
}

// ---------------------------------------------------------------------------
// Loans class
// ---------------------------------------------------------------------------

export class Loans {
  // ---- State ----
  startupTime = new Date()
  startDownload = new Date()
  lastPartnerSearchCount = 0
  lastPartnerSearch: Record<string, any> = {}
  lastFiltered: KivaLoan[] = []
  activePartners: Partner[] = []
  loansFromKiva: KivaLoan[] = []
  partnersFromKiva: Partner[] = []
  lenderLoans: Record<string, number[]> = {}
  allDescriptionsLoaded = false
  isReadyFlag = false
  lenderLoansMessage = 'Lender ID not set'
  lenderLoansState: (typeof LenderLoansState)[keyof typeof LenderLoansState] = LenderLoansState.Unknown
  indexedLoans: Record<number, KivaLoan> = {}
  baseKivaParams: Record<string, any> = {}
  runningTotals: RunningTotals = { funded_amount: 0, funded_loans: 0, new_loans: 0, expired_loans: 0 }
  backgroundResyncCount = 0
  atheistListProcessed = false
  countries: Array<{ iso_code: string; name: string; region: string }> = []
  secondaryLoadState = ''
  lenderId: string | null = null
  startedAtheistDownload = false

  // ---- Options ----
  /* @internal */ getOptions: () => Record<string, any> = () => ({})
  private options: Record<string, any> = {}

  // ---- Queues ----
  private queueToRefreshActions: QueuedActions
  private queueNewLoanQueryActions: QueuedActions

  // ---- Timers ----
  private updateIntervalMs: number
  private updateIntervalHandle = 0
  private hotLoansIntervalHandle = 0
  private startGettingLoansHandle = 0
  private repaidInRecalcHandle = 0

  // ---- Promises for sequencing ----
  private partnerDownloadPromise: Promise<void>
  private resolvePartnerDownload!: () => void
  private loanDownloadPromise: Promise<KivaLoan[]>
  // Resolvers/promises wired in constructor, consumed in async init flow
  _resolveLoanDownload!: (loans: KivaLoan[]) => void
  _rejectLoanDownload!: (reason: any) => void
  _loansProcessedPromise: Promise<void>
  private resolveLoansProcessed!: () => void

  // ---- Event callbacks (replaces Deferred.notify) ----
  private listeners: NotifyCallback[] = []

  constructor(updateInterval = 0) {
    this.updateIntervalMs = updateInterval

    this.queueToRefreshActions = new QueuedActions().init({
      action: (ids: number[]) => this.refreshLoans(ids),
      isReady: () => this.isReady(),
      waitFor: 5000,
    })

    this.queueNewLoanQueryActions = new QueuedActions().init({
      action: (ids: number[]) => this.newLoanNotice(ids),
      isReady: () => this.isReady(),
      waitFor: 2000,
    })

    this.partnerDownloadPromise = new Promise<void>((resolve) => {
      this.resolvePartnerDownload = resolve
    })
    this.loanDownloadPromise = new Promise<KivaLoan[]>((resolve, reject) => {
      this._resolveLoanDownload = resolve
      this._rejectLoanDownload = reject
    })
    this._loansProcessedPromise = new Promise<void>((resolve) => {
      this.resolveLoansProcessed = resolve
    })

    if (this.updateIntervalMs > 0) {
      this.updateIntervalHandle = window.setInterval(
        () => this.backgroundResync(),
        this.updateIntervalMs,
      )
    }
  }

  // ---- Event system (replaces Deferred.notify / .progress) ----

  onNotify(cb: NotifyCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private notify(message: NotifyMessage): void {
    for (const cb of this.listeners) {
      try {
        cb(message)
      } catch (e) {
        console.error('Loans.notify listener error', e)
      }
    }
  }

  // ---- Init ----

  async init(
    crit: Partial<Criteria>,
    getOptions: () => Record<string, any>,
    apiOptions?: Record<string, any>,
  ): Promise<void> {
    if (apiOptions) setAPIOptions(apiOptions)
    crit = { ...crit }
    this.getOptions = getOptions
    this.options = getOptions()

    this.hotLoansIntervalHandle = window.setInterval(
      () => this.checkHotLoans(),
      2 * 60_000,
    )

    this.notify({ loan_load_progress: { done: 0, total: 1, label: 'Fetching Partners...' } })

    let maxRepaymentDate: Date | null = null
    let needSecondary = false
    const baseOptions: Record<string, any> = {
      maxRepaymentTerms: 120,
      maxRepaymentTerms_on: false,
      ...this.options,
    }

    // Wire the loan-download promise to setKivaLoans
    this.loanDownloadPromise
      .then(async (loans) => {
        this.setKivaLoans(loans, true, true)
        this.resolveLoansProcessed()
        this.partnerDownloadPromise.then(() => {
          this.notify({ loans_loaded: true, loan_load_progress: { complete: true } })
        })
        // Start background resync shortly after initial load
        await wait(1000)
        this.backgroundResync()
      })
      .catch((e) => this.notify({ failed: e }))

    this.setLender(baseOptions.kiva_lender_id)

    // Recalculate repaid_in daily (field changes over time but isn't a function)
    this.repaidInRecalcHandle = window.setInterval(() => {
      const now = today()
      for (const loan of this.loansFromKiva) {
        if (loan.kls_final_repayment) {
          loan.kls_repaid_in = Math.abs(
            (loan.kls_final_repayment.getFullYear() - now.getFullYear()) * 12 +
            (loan.kls_final_repayment.getMonth() - now.getMonth()),
          )
        } else {
          loan.kls_repaid_in = 0
        }
      }
    }, 6 * 60 * 60_000)

    // ---- Partner loading ----
    const fetchPartnersFromKiva = async () => {
      try {
        await this.getAllPartners()
      } catch (e) {
        this.notify({ failed: e })
      }
    }

    const fetchPartnersFromKL = async () => {
      const partners = await req.kl.get('partners')
      this.processPartners(partners)
      const hasAtheistScores = this.partnersFromKiva.some((partner) => !!partner.atheistScore)
      if (hasAtheistScores) {
        this.atheistListProcessed = true
        this.notify({ atheist_list_loaded: true })
      } else if (this.options.mergeAtheistList !== false) {
        await this.getAtheistList()
      }
      // Clear cached partner refs on loans so they re-resolve
      for (const l of this.loansFromKiva) delete (l as any).kl_partner
    }

    /** Try KL for partners, fall back to Kiva if unavailable or option set */
    const fetchPartners = async () => {
      if (this.options.loansFromKiva) {
        return fetchPartnersFromKiva()
      }
      try {
        await fetchPartnersFromKL()
      } catch (e) {
        cl('KL partner load failed, falling back to Kiva', e)
        await fetchPartnersFromKiva()
      }
    }

    // ---- Load from Kiva (fallback) ----
    const loadFromKiva = async () => {
      cl('Loading from Kiva (fallback)...')
      fetchPartners()
      window.setInterval(fetchPartners, 6 * 60 * 60_000)

      if (baseOptions.maxRepaymentTerms_on) {
        const months = parseInt(baseOptions.maxRepaymentTerms, 10)
        maxRepaymentDate = today()
        maxRepaymentDate.setMonth(maxRepaymentDate.getMonth() + months)
        needSecondary = true
      }

      const kivaParams = this.convertCriteriaToKivaParams(crit) ?? {}
      try {
        const searchInstance = new LoansSearch(kivaParams, true, maxRepaymentDate)
        const loans = await searchInstance.start((progress: ProgressEvent) => {
          this.notify({ loan_load_progress: progress })
        })
        this.setKivaLoans(loans)
        this.notify({ loans_loaded: true })
        this.allDescriptionsLoaded = true
        this.notify({ all_descriptions_loaded: true })

        if (needSecondary) {
          await this.secondaryLoad()
        } else {
          this.resolveLoansProcessed()
        }
      } catch (e) {
        this.notify({ failed: e })
      }
    }

    // ---- Load from KL server (fast path) ----
    const loadFromKL = async (klStart: KLApiStart) => {
      cl('Loading from KL server...', klStart)

      if (!klStart.pages) {
        // KL server just restarted and hasn't built its batch yet — fall back
        cl('KL server has no pages ready, falling back to Kiva')
        return loadFromKiva()
      }

      const { batch, pages, loanLengths, descrLengths } = klStart
      const totalLoanBytes = loanLengths.reduce((a, b) => a + b, 0)

      this.notify({
        loan_load_progress: {
          singlePass: true,
          task: 'details',
          done: 0,
          total: totalLoanBytes,
          title: 'Loading loans from KivaLens.org',
          label: 'Loading loans from KivaLens server...',
        },
      })

      // ---- KL partners + loans in parallel ----
      const partnersPromise = fetchPartners()
      window.setInterval(fetchPartners, 24 * 60 * 60_000)

      try {
        let receivedPages = 0
        const allLoans: KivaLoan[] = []

        // Fetch all loan pages in parallel
        const pagePromises = Array.from({ length: pages }, (_, i) => i + 1).map(async (page) => {
          const loans: any[] = await req.kl.get(`loans/${batch}/${page}`)
          return { page, loans }
        })

        for (const pagePromise of pagePromises) {
          const { loans: rawLoans } = await pagePromise
          receivedPages++
          this.notify({
            loan_load_progress: {
              label: `Loading loan packets from KivaLens server ${receivedPages} of ${pages}...`,
            },
          })
          allLoans.push(...ResultProcessors.processLoans(rawLoans))
        }

        // Resolve the loan download with all loans
        this.setKivaLoans(allLoans, true, true)
        this.resolveLoansProcessed()

        // Fetch incremental updates since this batch
        try {
          const sinceLast: KivaLoan[] = await req.kl.get(`since/${batch}`)
          if (sinceLast?.length) this.setKivaLoans(sinceLast, false)
        } catch (e) {
          cl('since-batch fetch failed (non-fatal)', e)
        }

        // Ensure partners are loaded before filtering (filter needs partner IDs)
        await partnersPromise

        this.notify({ loans_loaded: true, loan_load_progress: { complete: true } })

        // Start background resync after 5 minutes (KL loads are already fresh)
        wait(5 * 60_000).then(() => this.backgroundResync())
      } catch (e) {
        cl('KL loan load failed, falling back to Kiva', e)
        return loadFromKiva()
      }

      // ---- KL descriptions / keywords ----
      if (!baseOptions.doNotDownloadDescriptions && descrLengths?.length) {
        try {
          const descrPages = Array.from({ length: pages }, (_, i) => i + 1)
          const allDescr: Array<{ id: number; t: string[] }> = []
          for (const page of descrPages) {
            const descriptions: Array<{ id: number; t: string[] }> = await req.kl.get(
              `loans/${batch}/keywords/${page}`,
            )
            allDescr.push(...descriptions)
          }
          // Wait for loans to be processed, then merge descriptions
          await this._loansProcessedPromise
          await wait(200)
          for (const desc of allDescr) {
            const loan = this.getById(desc.id)
            if (loan) {
              loan.kls_use_or_descr_arr = desc.t
            }
          }
          this.allDescriptionsLoaded = true
          this.notify({ all_descriptions_loaded: true })
        } catch (e) {
          cl('KL description download failed (non-fatal)', e)
        }
      }
    }

    // ---- Fetch KL API start info ----
    const fetchKLApiStart = async (): Promise<KLApiStart | null> => {
      // In production, the server injects this into the HTML
      if ((window as any).kl_api_start) {
        return (window as any).kl_api_start as KLApiStart
      }

      // In development, the local KL dev server serves this at /api/start
      try {
        const response = await fetch('/api/start')
        if (!response.ok) return null
        const data = (await response.json()) as KLApiStart
        cl('Got kl_api_start from local dev server:', data)
        return data
      } catch (e) {
        cl('KL dev server not ready:', e)
      }
      return null
    }

    // ---- Start loading: decide source ----
    this.startDownload = new Date()
    let hasStarted = false

    const startGettingLoans = async () => {
      if (hasStarted) {
        clearInterval(this.startGettingLoansHandle)
        return
      }
      hasStarted = true

      // Check user option: force Kiva fallback
      if (this.options.loansFromKiva) {
        cl('User option loansFromKiva is set — loading from Kiva')
        loadFromKiva()
        return
      }

      // Try KL server first
      const klStart = await fetchKLApiStart()
      if (klStart && klStart.pages > 0) {
        loadFromKL(klStart)
      } else {
        cl('KL server not available or has no data — loading from Kiva')
        loadFromKiva()
      }
    }

    setTimeout(startGettingLoans, 10)
    this.startGettingLoansHandle = window.setInterval(startGettingLoans, 10_000)
  }

  // ---- GraphQL description + repayment fetch ----

  async fetchDescrAndRepayments(loans: KivaLoan | KivaLoan[]): Promise<void> {
    const loanArr = Array.isArray(loans) ? loans : [loans]
    const ids = loanArr.map((l) => l.id).join(',')
    const data = await (req.kl as any).graph(
      `{loans(ids:[${ids}]){
        id
        description{texts{en}}
        kl_repayments:repayments {date display amount percent}
      }}`,
    )
    if (data?.loans) {
      for (const vd of data.loans) {
        this.mergeExtraLoanData(vd)
      }
    }
  }

  // ---- Hot loans ----

  checkHotLoans(): void {
    if (!this.isReady()) return

    const mostPopular = this.filter(
      { loan: { sort: 'popular', limit_results: 20 } } as Partial<Criteria>, false,
    ).map((l) => l.id)

    const aboutToExpire = this.filter(
      { loan: { sort: 'none', expiring_in_days_max: 0.1 } } as Partial<Criteria>, false,
    ).map((l) => l.id)

    const closeToFunded = this.filter(
      { loan: { sort: 'none', still_needed_max: 100 } } as Partial<Criteria>, false,
    ).map((l) => l.id)

    const showing = this.lastFiltered.slice(0, 20).map((l) => l.id)

    const allToCheck = Array.from(new Set([...mostPopular, ...aboutToExpire, ...closeToFunded, ...showing]))
    cl('checkHotLoans', allToCheck)
    this.refreshLoans(allToCheck)
  }

  // ---- Partner & Sector & Country list getters ----

  getListOfPartners(crit: Criteria): number[] {
    return this.filterPartners(crit).slice().sort((a: number, b: number) => a - b)
  }

  getListOfSectors(crit: Criteria): string[] {
    let sectors = [...defaultKivaData.sectors]

    if ((crit.loan as any).sector) {
      const values = (crit.loan as any).sector.split(',')
      const predicate =
        (crit.loan as any).sector_all_any_none === 'none'
          ? (s: string) => !values.includes(s)
          : (s: string) => values.includes(s)
      sectors = sectors.filter(predicate)
    }

    const pb = crit.portfolio?.pb_sector
    if (pb?.enabled && pb.values?.length) {
      const vals = pb.values as string[]
      const predicate =
        pb.hideshow === 'hide'
          ? (n: string) => !vals.includes(n)
          : (n: string) => vals.includes(n)
      sectors = sectors.filter(predicate)
    }

    return sectors
  }

  getListOfCountries(crit: Criteria): string[] {
    const countries = [...defaultKivaData.countries]
    let cnames = countries.map((c) => c.name)

    if ((crit.loan as any).country_code) {
      const values = (crit.loan as any).country_code.split(',')
      const predicate =
        (crit.loan as any).country_code_all_any_none === 'none'
          ? (c: { code: string; name: string }) => !values.includes(c.code)
          : (c: { code: string; name: string }) => values.includes(c.code)
      cnames = countries.filter(predicate).map((c) => c.name)
    }

    const pb = crit.portfolio?.pb_country
    if (pb?.enabled && pb.values?.length) {
      const vals = pb.values as string[]
      const predicate =
        pb.hideshow === 'hide'
          ? (n: string) => !vals.includes(n)
          : (n: string) => vals.includes(n)
      cnames = cnames.filter(predicate)
    }

    return cnames
  }

  // ---- Partner filtering ----

  filterPartners(
    c: Partial<Criteria>,
    useCache = false,
    idsOnly = true,
    partnerPool?: Partner[],
  ): any[] {
    if (this.lastPartnerSearchCount > 10) {
      this.lastPartnerSearch = {}
      this.lastPartnerSearchCount = 0
    }

    const partner = (c.partner ?? {}) as Record<string, any>
    const portfolio = (c.portfolio ?? {}) as PortfolioCriteria

    const cacheKey = JSON.stringify({
      filterPartnersParams: { idsOnly },
      ...partner,
      balancing: portfolio.pb_partner,
    })

    if (useCache && this.lastPartnerSearch[cacheKey]) {
      return this.lastPartnerSearch[cacheKey]
    }

    this.lastPartnerSearchCount++

    // Parse social_performance
    let spArr: number[] = []
    try {
      if (typeof partner.social_performance === 'string') {
        spArr = partner.social_performance
          .split(',')
          .filter((sp: string) => sp && !isNaN(Number(sp)))
          .map((sp: string) => parseInt(sp, 10))
      }
    } catch {
      spArr = []
    }

    // Explicitly given partner IDs
    let partnersGiven: number[] = []
    if (partner.partners) {
      const p = partner.partners
      partnersGiven = (Array.isArray(p) ? p : p.toString().split(','))
        .map((id: any) => parseInt(id, 10))
    }

    const ct = new CritTester(partner)

    // Status filter (only when searching all partners, not just active)
    if (partnerPool) {
      ct.addAnyAllNoneTester('status', null, 'any', (p: Partner) => p.status)
    }

    // Country filter for partners
    if (partner.country_code) {
      const countryCodes = partner.country_code.split(',')
      const countryMode = partner.country_code_all_any_none || 'any'
      if (countryMode === 'none') {
        ct.testers.push((p: Partner) => !(p.countries || []).some((c) => countryCodes.includes(c.iso_code)))
      } else if (countryMode === 'all') {
        ct.testers.push((p: Partner) => countryCodes.every((code: string) => (p.countries || []).some((c) => c.iso_code === code)))
      } else {
        ct.testers.push((p: Partner) => (p.countries || []).some((c) => countryCodes.includes(c.iso_code)))
      }
    }

    ct.addAnyAllNoneTester('region', null, 'any', (p: Partner) => p.kl_regions, true)
    ct.addAnyAllNoneTester('social_performance', spArr, 'all', (p: Partner) => p.kl_sp, true)
    ct.addAnyAllNoneTester('partners', partnersGiven, 'any', (p: Partner) => p.id)
    ct.addRangeTesters('partner_default', (p: Partner) => p.default_rate)
    ct.addRangeTesters('partner_arrears', (p: Partner) => p.delinquency_rate)
    ct.addRangeTesters('portfolio_yield', (p: Partner) => p.portfolio_yield)
    ct.addRangeTesters('profit', (p: Partner) => p.profitability)
    ct.addRangeTesters('loans_at_risk_rate', (p: Partner) => p.loans_at_risk_rate)
    ct.addRangeTesters('currency_exchange_loss_rate', (p: Partner) => p.currency_exchange_loss_rate)
    ct.addRangeTesters('average_loan_size_percent_per_capita_income', (p: Partner) => p.average_loan_size_percent_per_capita_income)
    ct.addRangeTesters('years_on_kiva', (p: Partner) => p.kl_years_on_kiva)
    ct.addRangeTesters('loans_posted', (p: Partner) => p.loans_posted)

    // Build fundraising loan count per partner from currently loaded loans
    const flcMap: Record<number, number> = {}
    for (const loan of this.loansFromKiva) {
      if (loan.status === 'fundraising' && loan.partner_id != null) {
        flcMap[loan.partner_id] = (flcMap[loan.partner_id] ?? 0) + 1
      }
    }
    ct.addRangeTesters('fundraising_loan_count', (p: Partner) => flcMap[p.id] ?? 0)

    ct.addThreeStateTester(partner.charges_fees_and_interest, (p: Partner) => p.charges_fees_and_interest)

    if (this.atheistListProcessed) {
      ct.addRangeTesters(
        'secular_rating',
        (p: Partner) => p.atheistScore?.secularRating,
        (p: Partner) => !p.atheistScore,
      )
      ct.addRangeTesters(
        'social_rating',
        (p: Partner) => p.atheistScore?.socialRating,
        (p: Partner) => !p.atheistScore,
      )
    }

    ct.addAnyAllNoneTester('religion', null, 'any', (p: Partner) => p.normalizedReligions || ['Unknown'], true)
    ct.addBalancer(portfolio.pb_partner, (p: Partner) => p.id)
    ct.addRangeTesters(
      'partner_risk_rating',
      (p: Partner) => p.rating,
      (p: Partner) => isNaN(parseFloat(String(p.rating))),
      (crit: any) => crit.partner_risk_rating_min == null,
    )

    cl('crit:partner:testers', ct.testers)

    const pool = partnerPool || this.activePartners
    let result: any[] = pool.filter((p) => ct.allPass(p))
    if (idsOnly) {
      result = result.map((p) => p.id)
    }

    this.lastPartnerSearch[cacheKey] = result
    return result
  }

  filterAllPartners(criteria: Partial<PartnerCriteria>): Partner[] {
    if (!this.partnersFromKiva?.length) return []

    const c: Partial<Criteria> = {
      partner: { ...criteria } as any,
      portfolio: {} as PortfolioCriteria,
    }
    const name = (c.partner as any).name
    delete (c.partner as any).name

    let results = this.filterPartners(c, false, false, this.partnersFromKiva) as Partner[]

    if (name && name.trim().length > 0) {
      const terms = name.toUpperCase().match(/(\w+)/g)
      if (terms) {
        results = results.filter((p: Partner) =>
          terms.every((term: string) => (p.kl_name_arr || []).some((w) => w.startsWith(term))),
        )
      }
    }

    return results
  }

  // ---- Loan filtering ----

  filter(
    c: Partial<Criteria>,
    cacheResults = true,
    loansToFilter?: KivaLoan[],
  ): KivaLoan[] {
    if (!this.isReady()) return []

    // Ensure all sub-objects exist
    const criteria = {
      loan: { ...(c.loan ?? {}) } as Record<string, any>,
      partner: { ...(c.partner ?? {}) } as Record<string, any>,
      portfolio: { ...(c.portfolio ?? {}) } as PortfolioCriteria,
    }

    const ct = new CritTester(criteria.loan)

    ct.addAnyAllNoneTester('sector', null, 'any', (l: KivaLoan) => l.sector)
    ct.addAnyAllNoneTester('activity', null, 'any', (l: KivaLoan) => l.activity)
    ct.addAnyAllNoneTester('country_code', null, 'any', (l: KivaLoan) => l.location.country_code)
    ct.addAnyAllNoneTester('tags', null, 'all', (l: KivaLoan) => l.kls_tags, true)
    ct.addAnyAllNoneTester('themes', null, 'all', (l: KivaLoan) => l.themes, true)

    ct.addFieldContainsOneOfArrayTester(
      criteria.loan.repayment_interval,
      (l: KivaLoan) => l.terms.repayment_interval ?? 'unknown',
    )
    ct.addFieldContainsOneOfArrayTester(
      criteria.loan.currency_exchange_loss_liability,
      (l: KivaLoan) => l.terms.loss_liability?.currency_exchange,
    )

    ct.addRangeTesters('repaid_in', (l: KivaLoan) => l.kls_repaid_in)
    ct.addRangeTesters('borrower_count', (l: KivaLoan) => l.borrower_count)
    ct.addRangeTesters('percent_female', (l: KivaLoan) => l.kl_percent_women)
    ct.addRangeTesters('age', (l: KivaLoan) => l.kls_age)
    ct.addRangeTesters('still_needed', (l: KivaLoan) => l.kl_still_needed)
    ct.addRangeTesters('loan_amount', (l: KivaLoan) => l.loan_amount)
    ct.addRangeTesters('dollars_per_hour', (l: KivaLoan) => (l as any).kl_dollars_per_hour?.())
    ct.addRangeTesters('percent_funded', (l: KivaLoan) => l.kl_percent_funded)
    ct.addRangeTesters('expiring_in_days', (l: KivaLoan) => (l as any).kl_expiring_in_days?.())
    ct.addRangeTesters('disbursal_in_days', (l: KivaLoan) => (l as any).kl_disbursal_in_days?.())

    ct.addArrayAllStartWithTester(criteria.loan.use, (l: KivaLoan) => l.kls_use_or_descr_arr)
    ct.addArrayAllStartWithTester(criteria.loan.name, (l: KivaLoan) => l.kl_name_arr)

    // Partner filtering (BOTH is also an option)
    if (!criteria.partner.direct || criteria.partner.direct === '') {
      ct.addFieldContainsOneOfArrayTester(
        this.filterPartners(criteria as Criteria),
        (l: KivaLoan) => l.partner_id,
        true,
      )
    } else if (criteria.partner.direct === 'direct') {
      ct.testers.push((l: KivaLoan) => l.partner_id == null)
    }

    // Exclude portfolio loans
    if (
      criteria.portfolio.exclude_portfolio_loans === 'true' &&
      this.lenderId &&
      this.lenderLoans[this.lenderId]?.length
    ) {
      ct.addFieldNotContainsOneOfArrayTester(
        this.lenderLoans[this.lenderId],
        (l: KivaLoan) => l.id,
      )
    }

    ct.addBalancer(criteria.portfolio.pb_sector, (l: KivaLoan) => l.sector)
    ct.addBalancer(criteria.portfolio.pb_country, (l: KivaLoan) => l.location.country)
    ct.addBalancer(criteria.portfolio.pb_activity, (l: KivaLoan) => l.activity)
    ct.addThreeStateTester(criteria.loan.bonus_credit_eligibility, (l: KivaLoan) => l.bonus_credit_eligibility === true)

    // Only show fundraising loans
    ct.testers.push((l: KivaLoan) => l.status === 'fundraising')

    // Exclude loans already fully funded on Kiva (funded >= total). basket_amount
    // is intentionally ignored — Kiva's basket data is unreliable and can exceed
    // the remaining amount; only funded vs. total decides fundability. This is the
    // live-session safety net for loans that hit 100% after the server shipped
    // them (funded_amount is updated in real time via mergeLoanAndNotify).
    ct.testers.push((l: KivaLoan) => (l.funded_amount ?? 0) < l.loan_amount)

    cl('crit:loan:testers', ct.testers)

    let filtered = (loansToFilter || this.loansFromKiva).filter((loan) => ct.allPass(loan))

    // Limit-to logic (limit N per Partner/Country/Activity/Sector)
    const limitTo = criteria.loan.limit_to
    if (limitTo?.enabled) {
      const count = isNaN(limitTo.count) ? 1 : limitTo.count
      let selector: ((l: KivaLoan) => any) | undefined
      switch (limitTo.limit_by) {
        case 'Partner':
          selector = (l) => l.partner_id
          break
        case 'Country':
          selector = (l) => l.location.country_code
          break
        case 'Activity':
          selector = (l) => l.activity
          break
        case 'Sector':
          selector = (l) => l.sector
          break
      }
      if (selector) {
        const groups = groupBy(filtered, selector)
        filtered = groups.flatMap((g) => sortLoans(g, criteria.loan.sort).slice(0, count))
      }
    }

    filtered = sortLoans(filtered, criteria.loan.sort)

    if (criteria.loan.limit_results) {
      filtered = filtered.slice(0, criteria.loan.limit_results)
    }

    if (cacheResults) {
      this.lastFiltered = filtered
    }

    return filtered
  }

  // ---- Atheist list ----

  async getAtheistList(): Promise<void> {
    if (this.startedAtheistDownload || this.atheistListProcessed) return
    this.startedAtheistDownload = true

    try {
      const csv: string = await (req as any).gdocs?.atheist?.get?.()
      if (!csv) return
      const mfis = csvToPartnerScores(csv)
      for (const mfi of mfis) {
        const partner = this.getPartner(parseInt(mfi.id, 10))
        if (partner) {
          partner.atheistScore = {
            secularRating: parseInt(mfi.secularRating, 10),
            religiousAffiliation: mfi.religiousAffiliation,
            commentsOnSecularRating: mfi.commentsOnSecularRating,
            socialRating: parseInt(mfi.socialRating, 10),
            commentsOnSocialRating: mfi.commentsOnSocialRating,
            reviewComments: mfi.reviewComments,
          }
        }
      }
      processPartnerReligions(this.partnersFromKiva)
      this.atheistListProcessed = true
      this.notify({ atheist_list_loaded: true })
    } catch (e) {
      cl(`failed to retrieve Atheist list: ${e}`)
    }
  }

  // ---- Criteria conversion ----

  convertCriteriaToKivaParams(_crit: Partial<Criteria>): Record<string, any> | null {
    return null
  }

  setBaseKivaParams(params: Record<string, any>): void {
    this.baseKivaParams = params
  }

  // ---- Loan data merging ----

  mergeExtraLoanData(data: { id: number; [key: string]: any }): void {
    const loan = this.getById(data.id)
    if (loan) {
      Object.assign(loan, data)
    }
  }

  setKivaLoans(loans: KivaLoan[], reset = true, trustNoDupes = false): void {
    if (!loans.length) return
    if (loans.length && !(loans[0] as any).kl_processed) {
      ResultProcessors.processLoans(loans)
    }

    if (reset) {
      this.loansFromKiva = []
      this.indexedLoans = {}
    }

    if (reset && trustNoDupes) {
      this.loansFromKiva = loans
      for (const loan of loans) {
        this.indexedLoans[loan.id] = loan
      }
    } else {
      for (const loan of loans) {
        if (!this.hasLoan(loan.id)) {
          this.loansFromKiva.push(loan)
          this.indexedLoans[loan.id] = loan
        } else {
          this.mergeLoanAndNotify(this.getById(loan.id)!, loan)
        }
      }
    }

    this.isReadyFlag = true
  }

  // ---- Teardown ----

  kill(): void {
    clearInterval(this.updateIntervalHandle)
    clearInterval(this.hotLoansIntervalHandle)
    clearInterval(this.startGettingLoansHandle)
    clearInterval(this.repaidInRecalcHandle)
    this.queueToRefreshActions.destroy()
    this.queueNewLoanQueryActions.destroy()
  }

  // ---- Query helpers ----

  isReady(): boolean {
    return this.isReadyFlag
  }

  getById(id: number): KivaLoan | undefined {
    return this.indexedLoans[id]
  }

  hasLoan(id: number): boolean {
    return this.indexedLoans[id] !== undefined
  }

  getPartner(id: number): Partner | undefined {
    return this.partnersFromKiva.find((p) => p.id === id)
  }

  async fetchLender(lenderId: string): Promise<any> {
    return req.kiva.api.lender(lenderId)
  }

  async heartbeat(installId: string, lenderId: string, uptime: number): Promise<void> {
    try {
      await req.kl.get('/heartbeat', {
        install_id: installId,
        lender_id: lenderId,
        uptime: String(uptime),
        version: '2.0',
      })
    } catch {
      // Heartbeat failures are non-critical
    }
  }

  async fetchSuperGraphData(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString()
    return getUrl(
      `${location.protocol}//${location.host}/proxy/kiva/ajax/getSuperGraphData?${qs}`,
      { parseJSON: true, includeRequestedWith: true }
    )
  }

  // ---- Kiva search ----

  async searchKiva(kivaParams?: Record<string, any> | null, maxRepaymentDate?: Date | null): Promise<void> {
    const params = kivaParams || this.baseKivaParams
    try {
      const searchInstance = new LoansSearch(params, true, maxRepaymentDate ?? undefined)
      const loans = await searchInstance.start()
      this.setKivaLoans(loans)
    } catch (e) {
      this.notify({ failed: e })
    }
  }

  // ---- Partner loading ----

  processPartners(partners: Partner[]): void {
    cl('processPartners()')

    for (const newP of partners) {
      const existing = this.getPartner(newP.id)
      if (existing) {
        Object.assign(existing, newP)
      } else {
        this.partnersFromKiva.push(newP)
      }
    }

    this.activePartners = partners.filter((p) => p.status === 'active')

    for (const p of this.partnersFromKiva) {
      p.kl_name_arr = p.name ? p.name.toUpperCase().match(/(\w+)/g) ?? [] : []
    }

    processPartnerReligions(this.partnersFromKiva)

    // Gather all country objects from active partners, flatten and dedupe
    const allCountries = this.activePartners.flatMap((p) => p.countries ?? [])
    this.countries = distinct(
      allCountries,
      (a, b) => a.iso_code === b.iso_code,
    ).slice().sort((a, b) => a.name.localeCompare(b.name))

    this.resolvePartnerDownload()
  }

  async getAllPartners(): Promise<void> {
    try {
      const searchInstance = new Partners()
      const partners = await searchInstance.start()
      this.processPartners(partners as Partner[])
      await this.getAtheistList()
    } catch (e) {
      this.notify({ failed: e })
      throw e
    }
  }

  // ---- Lender ----

  // Re-fetch the lender's currently-supported fundraising loans from Kiva's
  // public lenders/{id}/loans.json. Used both for portfolio exclusion and to
  // confirm (T1.1) which checked-out loans actually went through.
  async refreshLenderFundraisingLoans(): Promise<number[]> {
    const id = this.lenderId
    if (!id) return []
    const ids = await new LenderFundraisingLoans(id).ids()
    this.lenderLoans[id] = ids
    return ids
  }

  setLender(lenderId?: string | null): void {
    if (!lenderId) {
      this.lenderId = ''
      this.lenderLoansMessage = 'Lender ID not set'
      this.lenderLoansState = LenderLoansState.Unknown
      return
    }
    this.lenderId = lenderId
    if (!this.lenderLoans) this.lenderLoans = {}
    this.lenderLoans[lenderId] = []

    if (this.lenderLoansState === LenderLoansState.Downloading) return
    this.lenderLoansMessage = `Loading fundraising loans for ${this.lenderId} (Please wait...)`
    this.lenderLoansState = LenderLoansState.Downloading
    this.notify({ lender_loans_event: 'started' })

    const processIds = (ids: number[]) => {
      this.lenderLoans[lenderId] = ids
      this.lenderLoansMessage = `Fundraising loans for ${lenderId} found: ${ids.length}`
      this.lenderLoansState = LenderLoansState.Complete
      this.notify({ lender_loans_event: 'done' })
      cl('LENDER LOAN IDS:', ids)
    }

    const markFailed = () => {
      this.lenderLoans[lenderId] = []
      this.lenderLoansMessage =
        `Something went wrong when searching for loans for ${lenderId}. ` +
        'Cannot exclude loans you\'ve made. If problem persists, go to Options ' +
        'and instruct KivaLens to download your loans directly from Kiva.'
      this.lenderLoansState = LenderLoansState.Complete
      this.notify({ lender_loans_event: 'done' })
    }

    wait(500).then(async () => {
      try {
        const lfl = new LenderFundraisingLoans(lenderId)
        const ids = await (lfl as any).ids()
        processIds(ids)
      } catch {
        markFailed()
      }
    })
  }

  // ---- Single-loan refresh ----

  async refreshLoan(loan: KivaLoan): Promise<KivaLoan> {
    const freshLoan = await this.getLoanFromKiva(loan.id)
    this.mergeLoanAndNotify(loan, freshLoan)
    return loan
  }

  /**
   * CRITICAL: After merging dynamic fields, recalculate computed fields
   * (fix for stale kl_still_needed after sync).
   */
  mergeLoanAndNotify(existing: KivaLoan, refreshed: Partial<KivaLoan>, extra?: Partial<KivaLoan>): void {
    if (existing.status === 'fundraising') {
      if (existing.funded_amount !== refreshed.funded_amount && refreshed.funded_amount !== undefined) {
        this.runningTotals.funded_amount += refreshed.funded_amount - existing.funded_amount
        existing.kl_dynamicFieldChange = Date.now()
      }
    }
    const oldStatus = existing.status

    // Only merge funded_amount upward to avoid race conditions with data-stream updates
    if (refreshed.funded_amount !== undefined && refreshed.funded_amount < existing.funded_amount) {
      const { funded_amount: _, ...rest } = refreshed
      Object.assign(existing, rest, extra ?? {})
    } else {
      Object.assign(existing, refreshed, extra ?? {})
    }

    // Recalculate computed fields that depend on the dynamic fields we just merged
    existing.kl_still_needed = Math.max(
      existing.loan_amount - existing.funded_amount,
      0,
    )
    existing.kl_percent_funded =
      (100 * (existing.funded_amount + existing.basket_amount)) / existing.loan_amount

    if (oldStatus === 'fundraising' && refreshed.status !== 'fundraising' && refreshed.status !== undefined) {
      if (refreshed.status === 'funded' || refreshed.status === 'in_repayment') {
        this.runningTotals.funded_loans++
      }
      if (refreshed.status === 'expired') {
        this.runningTotals.expired_loans++
      }
      existing.kl_dynamicFieldChange = Date.now()
      this.notify({ loan_not_fundraising: existing })
    }

    this.notify({ running_totals_change: this.runningTotals })
    this.notify({ loan_updated: existing })
  }

  // ---- Fetch single loan from Kiva API ----

  async getLoanFromKiva(id: number): Promise<KivaLoan> {
    const [loan] = await Promise.all([
      (req.kiva as any).api.loan(id),
      this.partnerDownloadPromise,
    ])
    return loan
  }

  // ---- Batch refresh ----

  async refreshLoans(loanIdArr: number[]): Promise<void> {
    if (!loanIdArr.length) return
    try {
      const batchInstance = new LoanBatch(loanIdArr)
      const loans = await batchInstance.start()
      const newLoans: KivaLoan[] = []
      for (const loan of loans as KivaLoan[]) {
        const existing = this.indexedLoans[loan.id]
        if (existing) {
          this.mergeLoanAndNotify(existing, loan)
        } else {
          this.runningTotals.funded_amount += 25
          this.notify({ running_totals_change: this.runningTotals })
          newLoans.push(loan)
        }
      }
      if (newLoans.length) {
        this.setKivaLoans(newLoans, false)
      }
    } catch (e) {
      this.notify({ failed: e })
    }
  }

  // ---- Queue helpers ----

  queueToRefresh(loanIdArr: number[]): void {
    this.queueToRefreshActions.enqueue(loanIdArr)
  }

  queueNewLoanNotice(id: number): void {
    this.queueNewLoanQueryActions.enqueue(id)
  }

  // ---- New loan notice ----

  async newLoanNotice(idArr: number[]): Promise<void> {
    if (!this.isReady() || !idArr.length) return
    try {
      const batchInstance = new LoanBatch(idArr)
      const raw = await batchInstance.start()
      const loans = (raw as KivaLoan[]).filter((l) => l.status === 'fundraising')
      if (!loans.length) return

      cl('newLoanNotice:', loans)
      try {
        this.runningTotals.new_loans += loans.filter(
          (l) => l.kl_posted_date && l.kl_posted_date > this.startupTime,
        ).length
      } catch (e) {
        console.log('BAD DATE:', this.startupTime, (e as Error).message)
      }
      this.notify({ new_loans: loans })
      this.notify({ running_totals_change: this.runningTotals })
      this.setKivaLoans(loans, false)
    } catch (e) {
      this.notify({ failed: e })
    }
  }

  // ---- Secondary load (stage 2 for repayment-term-limited downloads) ----

  async secondaryLoad(): Promise<void> {
    this.secondaryLoadState = 'started'
    this.notify({ secondary_load: 'started' })

    try {
      const searchInstance = new LoansSearch({ ids_only: 'true' }, false)
      const allIds: number[] = await searchInstance.start()
      const newIds = allIds.filter((id) => !this.hasLoan(id))
      await this.newLoanNotice(newIds)
      this.secondaryLoadState = ''
      this.resolveLoansProcessed()
      this.notify({ secondary_load: 'complete' })
    } catch (e) {
      this.notify({ failed: e })
    }
  }

  // ---- Background resync ----

  async backgroundResync(shouldNotify = false): Promise<void> {
    this.backgroundResyncCount++
    const resyncNum = this.backgroundResyncCount

    if (shouldNotify) this.notify({ backgroundResync: { state: 'started' } })

    try {
      const searchInstance = new LoansSearch(this.baseKivaParams, false)
      const loans: KivaLoan[] = await searchInstance.start()

      let loansUpdated = 0
      const loansAdded: number[] = []

      for (const loan of loans) {
        const existing = this.indexedLoans[loan.id]
        if (existing) {
          if (
            existing.status !== loan.status ||
            existing.basket_amount !== loan.basket_amount ||
            existing.funded_amount !== loan.funded_amount
          ) {
            loansUpdated++
          }
          this.mergeLoanAndNotify(existing, loan, { kl_background_resync: resyncNum } as any)
        } else {
          loansAdded.push(loan.id)
        }
      }

      cl('LOANS UPDATED:', loansUpdated)
      if (loansUpdated > 0) this.notify({ background_updated: loansUpdated })

      // Find loans that are still fundraising but weren't in the resync results
      const miaLoanIds = this.loansFromKiva
        .filter((l) => l.status === 'fundraising' && (l as any).kl_background_resync !== resyncNum)
        .map((l) => l.id)

      // Refresh the missing loans
      this.refreshLoans(miaLoanIds)

      // Fetch full details for newly discovered loans
      this.newLoanNotice(loansAdded)

      if (shouldNotify) this.notify({ backgroundResync: { state: 'done' } })
    } catch (e) {
      this.notify({ failed: e })
    }
  }
}

// ---------------------------------------------------------------------------
// Sorting helper (extracted from filter's inner function)
// ---------------------------------------------------------------------------

export function sortLoans(loans: KivaLoan[], sortOption?: string | null): KivaLoan[] {
  if (loans.length <= 1) return loans

  switch (sortOption) {
    case 'half_back':
      return sortBy(
        loans,
        { fn: (l) => l.kls_half_back },
        { fn: (l) => l.kls_half_back_actual, desc: true },
        { fn: (l) => l.kls_75_back },
        { fn: (l) => l.kls_75_back_actual, desc: true },
        { fn: (l) => l.kls_final_repayment },
      )

    case 'popularity':
      return sortBy(loans, { fn: (l) => (l as any).kl_dollars_per_hour?.(), desc: true })

    case 'newest':
      return sortBy(
        loans,
        { fn: (l) => l.kl_newest_sort, desc: true },
        { fn: (l) => l.id, desc: true },
      )

    case 'expiring':
      return sortBy(
        loans,
        { fn: (l) => l.kl_planned_expiration_date?.getTime() },
        { fn: (l) => l.id },
      )

    case 'still_needed':
      return sortBy(loans, { fn: (l) => l.kl_still_needed })

    case 'none':
      return loans

    default:
      // Default: order by final repayment, then half back, 75 back
      return sortBy(
        loans,
        { fn: (l) => l.kls_final_repayment },
        { fn: (l) => l.kls_half_back },
        { fn: (l) => l.kls_half_back_actual, desc: true },
        { fn: (l) => l.kls_75_back },
        { fn: (l) => l.kls_75_back_actual, desc: true },
      )
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: Loans | null = null

function exposeForDebugging(instance: Loans) {
  // The original app exposed the singleton as window.kivaloans.
  ;(window as unknown as { kivaloans: Loans }).kivaloans = instance
}

export function getKivaLoans(): Loans {
  if (!_instance) {
    _instance = new Loans()
    exposeForDebugging(_instance)
  }
  return _instance
}

export function createKivaLoans(updateInterval?: number): Loans {
  if (_instance) {
    _instance.kill()
  }
  _instance = new Loans(updateInterval)
  exposeForDebugging(_instance)
  return _instance
}

// Re-export dependencies that the old module exported
export { LoansSearch, ResultProcessors, LoanBatch, setAPIOptions, req }
