/**
 * Generates an array of valid lend amount options up to maxAmount.
 * Increments by $25 up to $500, then by $100 after that.
 * Always includes maxAmount as the final option.
 */
export function lendAmountOptions(maxAmount: number): number[] {
  if (!maxAmount || maxAmount <= 0) return []
  const options: number[] = []
  let amount = 25
  while (amount < maxAmount) {
    options.push(amount)
    amount += amount < 500 ? 25 : 100
  }
  options.push(maxAmount)
  return options
}
