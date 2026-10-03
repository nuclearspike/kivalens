/**
 * The address that puts a KivaLens basket into the lender's basket at Kiva and
 * opens Kiva's checkout. Kiva adds the loans in the lender's own Kiva tab, so
 * the hand-off is a plain link: no form, no window to warm up, no timer. It does
 * not post to kiva.org/basket/set, because Kiva answers that address "page
 * missing" (2026-10-03).
 *
 * Kiva offers two such addresses, and neither returns the lender to KivaLens:
 *   - /add-loan-bundle?loanIds=1,2,3 adds each loan at $25, whatever was chosen
 *     here, and skips a loan it cannot add;
 *   - /process-instant-lending/<id>/<amount> adds one loan at the amount named.
 * One loan therefore goes with its amount. Several go as a bundle, and the ones
 * chosen at another amount are returned so the page can say they are set at
 * Kiva's checkout. It does not visit the single-loan address once per loan
 * because this page cannot see when Kiva has finished one, and a visit cut short
 * loses its loan without a word.
 *
 * A basket nobody is signed in to holds $150 of loans at Kiva and no more: the
 * loans past that are refused, by the bundle silently. A basket over that goes
 * through Kiva's sign-in (/ui-login?doneUrl=…), which sends a signed-in lender
 * straight on and asks anyone else to sign in first, so nothing is dropped. A
 * smaller basket goes direct, so a newcomer can still check out as a guest.
 *
 * Kiva's servers refuse an address that is too long (HTTP 414), so a basket of
 * several hundred loans goes a part at a time: the address carries the first
 * loans that fit, the rest stay in the basket, and the page says so. The loans
 * that went leave the basket when the checkout is reconciled, which makes the
 * rest the next part.
 */

/** What Kiva's bundle address lends to each loan. */
export const KIVA_BUNDLE_AMOUNT = 25

/**
 * Dollars of loans Kiva accepts in a basket nobody is signed in to. Measured on
 * 2026-10-03 (analysis/kiva-checkout-2026-10-03): six loans at $25 or one at
 * $150 went in, and the next $25 was refused each time. Kiva publishes no figure.
 */
export const KIVA_SIGNED_OUT_LIMIT = 150

/**
 * Characters an address to Kiva may run to. Measured on 2026-10-03: Kiva answered
 * a bundle address of 7,269 characters and a sign-in address of 6,095, and
 * refused one of 9,095 with 414. After sign-in Kiva passes the same address on
 * once more at about the same length, so this leaves room under the refusal for
 * both hops. It is about 590 loans.
 */
export const KIVA_ADDRESS_MAX = 6000

/**
 * Seconds Kiva's bundle address takes to add one loan: it adds them one after
 * another. Measured on 2026-10-03 with nobody signed in: 3 loans in 6 s, 6 in
 * 10.5 s, 8 in 13 s. A rough figure for telling the lender how long to allow.
 */
export const KIVA_SECONDS_PER_LOAN = 1.5

/** Kiva asks apps to name themselves when they link back (its API code of conduct, point 8). */
const APP_ID = 'org.kiva.kivalens'

const KIVA = 'https://www.kiva.org'

export interface CheckoutLoan {
  id: number
  /** Dollars the lender chose for this loan. */
  amount: number
  name?: string
}

export interface KivaHandoff {
  url: string
  /** Every loan the address carries, in basket order. */
  loans: CheckoutLoan[]
  /** Loans Kiva adds at another amount than the lender chose: they set these at Kiva's checkout. */
  setAtKiva: CheckoutLoan[]
  /** The basket is more than Kiva takes signed out, so the address goes through Kiva's sign-in. */
  needsSignIn: boolean
  /** Loans the address has no room for. They stay in the basket for the next checkout. */
  left: number
}

const sendable = (loan: CheckoutLoan | null | undefined): loan is CheckoutLoan =>
  !!loan && Number.isSafeInteger(loan.id) && loan.id > 0 && Number.isFinite(loan.amount) && loan.amount > 0

const bundlePath = (loans: CheckoutLoan[]) =>
  // Commas stay as they are: Kiva's own links to this address write them so.
  `/add-loan-bundle?loanIds=${loans.map((loan) => loan.id).join(',')}&app_id=${APP_ID}`

const throughSignIn = (path: string) => `${KIVA}/ui-login?doneUrl=${encodeURIComponent(path)}`

/** How many of these loans one address has room for, written the longer way, through sign-in. */
function fits(loans: CheckoutLoan[]): number {
  let length = throughSignIn(bundlePath([])).length
  let count = 0
  for (const loan of loans) {
    // An id and the comma before it, which sign-in's address writes as %2C.
    length += String(loan.id).length + (count === 0 ? 0 : 3)
    if (length > KIVA_ADDRESS_MAX) break
    count++
  }
  return count
}

/** The hand-off for these loans, or null when there is nothing Kiva could add. */
export function kivaHandoff(basket: CheckoutLoan[]): KivaHandoff | null {
  const seen = new Set<number>()
  const all = basket.filter((loan) => sendable(loan) && !seen.has(loan.id) && seen.add(loan.id))
  if (all.length === 0) return null
  const loans = all.slice(0, fits(all))

  const single = all.length === 1
  const path = single
    ? `/process-instant-lending/${loans[0].id}/${encodeURIComponent(String(loans[0].amount))}?app_id=${APP_ID}`
    : bundlePath(loans)

  // Judged on what the lender means to lend and on what the address adds, whichever
  // is more: amounts raised at Kiva's checkout count against the same limit.
  const chosen = loans.reduce((sum, loan) => sum + loan.amount, 0)
  const added = single ? chosen : loans.length * KIVA_BUNDLE_AMOUNT
  const needsSignIn = Math.max(chosen, added) > KIVA_SIGNED_OUT_LIMIT

  return {
    url: needsSignIn ? throughSignIn(path) : `${KIVA}${path}`,
    loans,
    setAtKiva: single ? [] : loans.filter((loan) => loan.amount !== KIVA_BUNDLE_AMOUNT),
    needsSignIn,
    left: all.length - loans.length,
  }
}

/** Minutes to allow Kiva for adding this many loans, at least one. */
export function minutesAtKiva(count: number): number {
  return Math.max(1, Math.round((count * KIVA_SECONDS_PER_LOAN) / 60))
}
