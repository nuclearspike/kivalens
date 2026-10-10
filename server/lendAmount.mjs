/**
 * What every loan goes to Kiva at, in dollars. It is the amount Kiva's bundle
 * address lends to each loan (src/lib/kivaCheckout.ts), and Kiva's own default.
 * The page and the assistant both read it here, so neither can tell a lender a
 * figure the other does not use.
 */
export const KIVA_LEND_AMOUNT = 25

/**
 * What one loan is added at: KIVA_LEND_AMOUNT, or what the loan still needs when
 * that is less, since Kiva cannot take more for a loan than it has left to raise.
 * A loan whose need is unknown, already met, or anything but a number counts at
 * KIVA_LEND_AMOUNT: the basket drops a loan with nothing left to raise when it
 * next refreshes.
 *
 * @param {unknown} stillNeeded dollars the loan has left to raise (kl_still_needed)
 * @returns {number}
 */
export function lendAmountFor(stillNeeded) {
  return typeof stillNeeded === 'number' && stillNeeded > 0 && stillNeeded < KIVA_LEND_AMOUNT ? stillNeeded : KIVA_LEND_AMOUNT
}
