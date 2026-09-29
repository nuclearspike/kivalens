export type AgeConfidence = 'certain' | 'likely' | 'ambiguous' | 'none'

export interface AgeReading {
  /** The borrower's age, or null. Filled in for an ambiguous read too — do not publish that one unresolved. */
  age: number | null
  confidence: AgeConfidence
  /** Why this reading, for logs and for the model prompt. */
  why: string
}

/**
 * Reads the borrower's age out of a loan description. `name` is the name on the loan: an age tied
 * to it is the borrower's, and every other age is then left out. `asOf` is when the story was
 * written (the loan's posted date, or a year); a birth year counts as the age it gives then.
 */
export declare function read(text: string | null | undefined, name?: string | null, asOf?: string | number | Date | null): AgeReading
/** The words of the name on the loan that a story may call the borrower by. */
export declare function nameTokens(name: string | null | undefined): string[]
/** True when the reading should go to resolveAmbiguousAges() before being published. */
export declare function needsReview(result: AgeReading): boolean
/** The age safe to publish from the text alone (null while a reading is ambiguous). */
export declare function ageFrom(result: AgeReading): number | null
/** The pre-2026-09 extractor, kept for scoring comparisons. */
export declare function readLegacy(text: string | null | undefined): number | null
