// Type surface for the criteria field registry (criteriaFields.mjs).
export type CriteriaGroup = 'loan' | 'partner' | 'portfolio'

export declare const LOAN_STRING_FIELDS: readonly string[]
export declare const LOAN_RANGE_FIELDS: readonly string[]
export declare const PARTNER_STRING_FIELDS: readonly string[]
export declare const PARTNER_RANGE_FIELDS: readonly string[]
export declare const PORTFOLIO_STRING_FIELDS: readonly string[]
export declare const BALANCER_FIELDS: readonly string[]
export declare const PARTNER_MODES: readonly ['both', 'mfi', 'direct']
export declare const BALANCER_SETTINGS: ReadonlyArray<{
  key: string
  values?: readonly string[]
  number?: { min: number; max: number }
  fallback: string | number
}>
export declare const LIMIT_BY_VALUES: readonly string[]
export declare const MAX_STRING_LENGTH: number
export declare const MIN_NUMBER: number
export declare const MAX_NUMBER: number
/** Which criteria group a field belongs to, by field name. */
export declare const FIELD_GROUP: ReadonlyMap<string, CriteriaGroup>
export declare const RANGE_FIELDS: ReadonlySet<string>
export declare const STRING_FIELDS: ReadonlySet<string>
export declare const BALANCER_SET: ReadonlySet<string>
