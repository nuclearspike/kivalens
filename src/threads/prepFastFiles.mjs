import fs from 'fs';
import zlib from 'zlib';
import { parentPort, workerData } from 'worker_threads';
import LoansSearch from '../kiva-api/LoansSearch.mjs';
import Partners from '../kiva-api/Partners.mjs';
import '../utils/linqextras.mjs';
import ResultProcessors from '../kiva-api/ResultProcessors.mjs';

// clean up old directories. (no code)

const gzipOpt = { level : 9 };
const brotliOpt = {
  chunkSize: 32 * 1024,
  params: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
  }
};

const tmpBatchesBatchDir = `/tmp/batches/${workerData.batch}/`;
fs.mkdirSync(tmpBatchesBatchDir, { recursive: true });

// const KLPageSplits = 4;

const gzipP = (input) => new Promise((resolve, reject) => {
    zlib.gzip(input, gzipOpt, (error, result) => {
      if(!error) resolve(result);
      else reject(Error(error));
    });
  });

const brotliP = (input) => new Promise((resolve, reject) => {
    zlib.brotliCompress(input, brotliOpt, (error, result) => {
      if(!error) resolve(result);
      else reject(Error(error));
    });
  });

const genHandler = (name) => {
  parentPort.postMessage({
    progress: `genHandler ${name}`,
  });
  return async (chunk) => {
    // -${forcePage !== undefined ? forcePage :page + 1}
    const filename = `${tmpBatchesBatchDir}${name}.kl`;
    const str_chunk = JSON.stringify(chunk);
    return (
      Promise.all([
        fs.promises.writeFile(`${filename}.gzip`, await gzipP(str_chunk)),
        fs.promises.writeFile(`${filename}.br`, await brotliP(str_chunk)),
      ])
    )
  }
}

/**
 * @param loan
 *
 * strip out anything that isn't needed. in order to make the download smaller.
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

const loans = new LoansSearch({ sort: 'newest' }) // q: 'Mary', region: 'as'
  .start()
  .progress(p => {
    if (p.done !== p.total) {
      parentPort.postMessage({
        progress: p,
      });
    }
  })
  .fail((e) => console.error(e))
  .then((loans) => {
    const keywords = [];

    loans.forEach(loan => {
      keywords.push({id: loan.id, t: loan.kls_use_or_descr_arr});
      ResultProcessors.unprocessLoanDestructive(loan);
      prepLoanForDownload(loan);
    });

    // const chunkSize = Math.ceil(loans.length / KLPageSplits);
    // ...loans.chunk(chunkSize).map(genHandler('loans')),
    // ...keywords.chunk(chunkSize).map(genHandler('keywords')),

    return Promise.all( [
      genHandler('loans')(loans),
      genHandler('keywords')(keywords),
    ]);
  });

const partners = new Partners().start().then((p) => genHandler('partners')(p));

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
