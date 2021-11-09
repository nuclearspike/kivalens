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

const { Deferred } = require('jquery-deferred');
const req = require('./req');

class LoanBatch {
  constructor(id_arr, process) {
    this.ids = id_arr;
    this.process = process;
  }

  start() {
    // kiva does not allow more than 100 loans in a batch. break the list into chunks of up to 100 and process them.
    const chunks = this.ids.chunk(100); // breaks into an array of arrays of 100.
    const def = Deferred();
    let r_loans = [];

    chunks.forEach(chunk => {
      def.notify({
        task: 'details',
        done: 0,
        total: 1,
        label: 'Downloading...',
      });
      req.kiva.api.loans(chunk, this.process).done(loans => {
        r_loans = r_loans.concat(loans);
        def.notify({
          task: 'details',
          done: r_loans.length,
          total: this.ids.length,
          label: `${r_loans.length}/${this.ids.length} downloaded`,
        });
        if (r_loans.length >= this.ids.length) def.resolve(r_loans);
      });
    });
    if (chunks.length == 0) def.reject(); // prevent done() processing on an empty set.
    return def;
  }
}

module.exports = LoanBatch;
