import fs from 'fs';
import zlib from 'zlib';
import brotli from 'brotli';
import { parentPort, workerData } from 'worker_threads';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import Partners from '../kiva-api/Partners.mjs';
import '../utils/linqextras.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';


const gzipOpt = { level : 9 };
const brotliOpt = { quality: 11, mode: 1 }

// const KLPageSplits = 4;

const gzipP = (input) => {
  return new Promise((resolve, reject) => {
    zlib.gzip(input, gzipOpt, (error, result) => {
      if(!error) resolve(result);
      else reject(Error(error));
    });
  });
};

const genHandler = (name, forcePage = undefined) => {
  parentPort.postMessage({
    progress: `genHandler ${name}`,
  });
  return async (chunk, page) => {
    const filename = `/tmp/${name}-${workerData.batch}-${forcePage !== undefined ? forcePage :page + 1}.kl`;
    const str_chunk = JSON.stringify(chunk);
    return (
      Promise.all([
        fs.promises.writeFile(`${filename}.gzip`, await gzipP(str_chunk)),
        // fs.promises.writeFile(`${filename}.br`, brotli.compress(str_chunk)), //brotliOpt
      ])
    )
  }
}

/**
 * @param loan
 *
 * strip out anything that isn't needed to make the download smaller.
 */
const prepLoanForDownload = (loan) => {
  delete loan.description //.texts.en
  delete loan.kls_use_or_descr_arr
  if (!loan.kls_age) delete loan.kls_age
  delete loan.lender_count
  if (!loan.funded_amount) delete loan.funded_amount
  if (!loan.basket_amount) delete loan.basket_amount
  if (!loan.kls_tags.length) delete loan.kls_tags
  delete loan.terms.repayment_term
  loan.klb = {}
  loan.borrowers.groupByWithCount(b=>b.gender).forEach(g=>loan.klb[g.name] = g.count)
  delete loan.borrowers
  delete loan.borrower_count
  delete loan.status
  delete loan.payments
  delete loan.terms.loss_liability.currency_exchange_coverage_rate
  delete loan.terms.scheduled_payments
  loan.kls = true
};

const loans = new LoansSearch({ q: '' })
  .start()
  .progress(p => {
    if (p.done !== p.total) {
      parentPort.postMessage({
        progress: p,
      });
    }
  })
  .then((loans) => {
    const keywords = [];

    loans.forEach((loan) => {
      keywords.push({id: loan.id, t: loan.kls_use_or_descr_arr});
      ResultProcessors.unprocessLoanDestructive(loan);
      prepLoanForDownload(loan);
    });

    // const chunkSize = Math.ceil(loans.length / KLPageSplits);
    // ...loans.chunk(chunkSize).map(genHandler('loans')),
    // ...keywords.chunk(chunkSize).map(genHandler('keywords')),

    return Promise.all( [
      genHandler('loans', 0)(loans, 0),
      genHandler('keywords', 0)(keywords, 0),
    ]);
  });

const partners = new Partners().start().then((partners) => (
  genHandler('partners', 0)(partners, 0)
));

Promise.all([
  loans.promise(),
  partners.promise(),
]).then((values) => {
  parentPort.postMessage({
    resolve: {
      done: true,
    },
  });
});
