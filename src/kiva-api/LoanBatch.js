/**
 *
 * Pass in an array of ids, it will break the array into 100 max chunks (kiva restriction) fetch them all, then returns
 * them together (very possible that they'll get out of order if more than one page; if order is important then order
 * the results yourself using a linqjs join against the original array request. this could be made more generic where
 * it doesn't know they are loans if needed in the future)
 *
 * Example use:
 *
 * var loans = new LoanBatch([1000,2000])
 * loans.start().done(results => console.log(results))
 *
 */
import {Deferred} from 'jquery-deferred'
import req from './req'

class LoanBatch {
  constructor(idArr, process) {
    this.ids = idArr
    this.process = process
  }

  start() {
    // kiva does not allow more than 100 loans in a batch. break the list into chunks of up to 100 and process them.
    const chunks = this.ids.chunk(100) // breaks into an array of arrays of 100.
    const def = Deferred()
    let rLoans = []

    chunks.forEach(chunk => {
      def.notify({
        task: 'details',
        done: 0,
        total: 1,
        label: 'Downloading...',
      })

      req.kiva.api.loans(chunk, this.process).done(loans => {
        rLoans = rLoans.concat(loans)
        def.notify({
          task: 'details',
          done: rLoans.length,
          total: this.ids.length,
          label: `${rLoans.length}/${this.ids.length} downloaded`,
        })
        if (rLoans.length >= this.ids.length) def.resolve(rLoans)
      })
    })
    if (chunks.length === 0) def.reject() // prevent done() processing on an empty set.
    return def
  }
}

export default LoanBatch
