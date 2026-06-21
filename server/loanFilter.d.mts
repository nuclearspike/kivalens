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
}

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
