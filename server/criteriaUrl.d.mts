// Type surface for the search-as-an-address encoding, so the TS client can use it.

import type { Criteria } from '../src/types'

export declare function criteriaToParams(criteria: Criteria | null | undefined): URLSearchParams
export declare function criteriaToSearch(criteria: Criteria | null | undefined): string
export declare function readableSearch(params: URLSearchParams): string
export declare function withCriteria(
  params: URLSearchParams,
  criteria: Criteria | null | undefined,
): string
export declare function criteriaFromParams(params: URLSearchParams): Criteria | null
export declare function hasCriteriaParams(params: URLSearchParams): boolean
export declare function isCriteriaParam(name: string): boolean
