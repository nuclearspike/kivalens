// Type surface for the shared (plain-JS) filter engine, so the TS client can
// import it. Loosely typed on purpose — criteria/loan/partner shapes vary.
export declare class CritTester {
  constructor(critGroup: Record<string, unknown>)
  critGroup: Record<string, unknown>
  testers: Array<(e: unknown) => boolean>
  failAll: boolean
  addRangeTesters(
    critName: string,
    selector: (e: never) => unknown,
    overrideIf?: (e: never) => boolean,
    overrideFunc?: (crit: never, e: never) => boolean,
  ): void
  addAnyAllNoneTester(
    critName: string,
    values: unknown[] | null,
    defValue: string,
    selector: (e: never) => unknown,
    entityFieldIsArray?: boolean,
  ): void
  addArrayAllTester(crit: unknown, selector: (e: never) => unknown): void
  addArrayAnyTester(crit: unknown, selector: (e: never) => unknown): void
  addArrayNoneTester(crit: unknown, selector: (e: never) => unknown): void
  addBalancer(crit: unknown, selector: (e: never) => unknown): void
  addFieldContainsOneOfArrayTester(crit: unknown, selector: (e: never) => unknown, failIfEmpty?: boolean): void
  addFieldNotContainsOneOfArrayTester(crit: unknown, selector: (e: never) => unknown): void
  addArrayAllStartWithTester(crit: unknown, selector: (e: never) => unknown): void
  addSimpleEquals(crit: string, selector: (e: never) => unknown): void
  addSimpleContains(crit: string, selector: (e: never) => unknown): void
  addThreeStateTester(crit: unknown, selector: (e: never) => unknown): void
  allPass(entity: unknown): boolean
  /** critName -> value selector for every range registered, set or not. */
  ranges: Record<string, (e: never) => unknown>
  /** '' = passes everything; a critName = only that range fails; null = anything else fails. */
  soleFailingRange(entity: unknown): string | null
}

/** One slider's histogram layout. discrete: one bin per stop, holding the values from that stop up to the next; otherwise equal-width bins over [min, max]. */
export interface BinSpec {
  min: number
  max: number
  count: number
  discrete: boolean
}

export interface RangeDistributionSpecs {
  loan?: Record<string, BinSpec>
  partner?: Record<string, BinSpec>
}

export interface RangeDistributions {
  loan: Record<string, number[]>
  partner: Record<string, number[]>
}

/** Per slider: loans matching all the OTHER criteria, binned along that slider's scale. */
export declare function rangeDistributions(criteria: unknown, ctx: FilterContext, specs: RangeDistributionSpecs): RangeDistributions
export declare function binIndex(value: unknown, spec: BinSpec): number

/** Counts what one range slider would return at any (min, max); null = no limit at that end. See rangeCounter in loanFilter.mjs. */
export declare function rangeCounter(
  c: unknown,
  ctx: Record<string, unknown>,
  group: 'loan' | 'partner',
  key: string,
  options?: { unit?: 'loans' | 'partners'; accept?: (partner: never) => boolean },
): (min: number | null, max: number | null) => number
/** Per partner dropdown: how many partners (matching every other filter) carry each option value. */
export declare function partnerOptionCounts(
  criteria: unknown,
  ctx: FilterContext,
  keys: string[],
  accept?: (partner: never) => boolean,
): Record<string, Record<string, number>>
/** The pool's numeric values for the given partner ranges, via the filter's own selectors. */
export declare function partnerRangeValues(ctx: FilterContext, keys: string[]): Record<string, number[]>
/** Per slider: PARTNERS in the pool matching all the other partner criteria (and `accept`), binned. */
export declare function partnerRangeDistributions(
  criteria: unknown,
  ctx: FilterContext,
  specs: Record<string, BinSpec>,
  accept?: (partner: never) => boolean,
): Record<string, number[]>

export declare function groupBy<T>(arr: T[], keyFn: (item: T) => unknown): T[][]
export declare function sortBy<T>(arr: T[], ...selectors: Array<{ fn: (item: T) => unknown; desc?: boolean }>): T[]
export declare function sortLoans<T = unknown>(loans: T[], sortOption?: string | null): T[]

export interface FilterContext {
  loans?: unknown[]
  activePartners?: unknown[]
  partnerPool?: unknown[]
  atheistListProcessed?: boolean
  lenderId?: string | null
  lenderLoans?: Record<string, number[]>
}

export declare function filterPartnerIds(c: unknown, ctx: FilterContext): number[]
export declare function filterPartners<T = unknown>(c: unknown, ctx: FilterContext): T[]
export declare function filterLoans<T = unknown>(c: unknown, ctx: FilterContext): T[]

export type PartnerMode = 'both' | 'mfi' | 'direct'
/** True when the search filters on the field partner (judged by the engine's own tests). */
export declare function partnerCriteriaSet(criteria: unknown): boolean
/** The MFI/Direct mode: the stored value, or — for a search saved before it existed — MFI when it filters on the partner, else Both. */
export declare function balancesByPartner(criteria: unknown): boolean
export declare function resolvePartnerMode(criteria: unknown): PartnerMode
/** Loans matching every other criterion that the mode or the already-lent filter keeps out of view. */
export declare function partnerModeGaps(
  criteria: unknown,
  ctx: Record<string, unknown>,
): { mode: PartnerMode; directNotShown: number; mfiNotShown: number; alreadyLentHidden: number }

/** A loan that can still be lent to: listed as fundraising and not fully funded. */
export declare function isFundraising(loan: unknown): boolean
