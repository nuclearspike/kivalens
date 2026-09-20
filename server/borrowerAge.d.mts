export type AgeConfidence = 'certain' | 'likely' | 'ambiguous' | 'none'

export interface AgeReading {
  /** The borrower's age, or null. Filled in for an ambiguous read too — do not publish that one unresolved. */
  age: number | null
  confidence: AgeConfidence
  /** Why this reading, for logs and for the model prompt. */
  why: string
}

/** Reads the borrower's age out of a loan description. */
export declare function read(text: string | null | undefined): AgeReading
/** True when the reading should go to resolveAmbiguousAges() before being published. */
export declare function needsReview(result: AgeReading): boolean
/** The age safe to publish from the text alone (null while a reading is ambiguous). */
export declare function ageFrom(result: AgeReading): number | null
/** The pre-2026-09 extractor, kept for scoring comparisons. */
export declare function readLegacy(text: string | null | undefined): number | null
