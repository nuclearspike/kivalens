'use strict'

/**
 * Builds the list of lending amount options for a loan.
 * - $25 increments up to $500
 * - $100 increments from $500 up to max
 * - Always includes the exact max as the final entry (if not already present)
 */
function lendAmountOptions(maxAmount) {
    if (!maxAmount || maxAmount <= 0) return []
    var options = []
    var amount = 25
    while (amount < maxAmount) {
        options.push(amount)
        amount += (amount < 500) ? 25 : 100
    }
    options.push(maxAmount)
    return options
}

export default lendAmountOptions
