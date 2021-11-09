const extend = require('extend');

const kivaLoanDynFields = ['status', 'funded_amount', 'basket_amount', 'tags']; // PLUS
const s_unknown = 'unknown';
const s_kvSummary = 'kiva_summary';
const s_kvDetail = 'kiva_detail';
const s_kl = 'kl';

class Loan {
  constructor(remote_loan) {
    this.kl_created = Date.now();
    this.kl_processed = new Date();
    extend(this, remote_loan);
  }

  process() {}

  kl_posted_hours_ago() {
    return (new Date() - this.kl_posted_date) / (60 * 60 * 1000);
  }

  kl_dollars_per_hour() {
    return (
      (this.funded_amount + this.basket_amount) / this.kl_posted_hours_ago()
    );
  }

  kl_expiring_in_days() {
    // today is not defined
    return (
      (this.kl_planned_expiration_date - Date.now()) / (24 * 60 * 60 * 1000)
    );
  }

  kl_disbursal_in_days() {
    // today is not defined
    return (
      (new Date(this.terms.disbursal_date) - Date.now()) / (24 * 60 * 60 * 1000)
    );
  }

  getPartner() {
    // todo: this should not reference kivaloans...
    if (!this.kl_partner)
      this.kl_partner = kivaloans.getPartner(this.partner_id);
    return this.kl_partner;
  }
}

// hmmm... just thinking through what the world would look like with this in place.
class FOOOLoan {
  constructor(remote_loan) {
    this.kl_created = Date.now();
    this.source = s_unknown;
    extend(this, remote_loan);
  }

  readFromCommon(c) {
    this.id = c.id;
    this.status = c.status;
    this.posted_date = c.posted_date;
  }

  readFromKL(KLLoan) {
    this.source = s_kl;
  }

  readSummaryFromAPI(apiLoan) {
    this.source = s_kvSummary;
  }

  readDetailsFromAPI(apiLoan) {
    this.source = s_kvDetail;
  }

  updateDynamicFieldsFromAPI(apiLoan) {
    kivaLoanDynFields.forEach(field => {
      if (this[field] != apiLoan[field]) {
        this[field] = apiLoan[field];
        this.kl_dynUpdated = Date.now();
      }
    });
  }

  transformToDownload() {
    // return a cloned object with only what a download object should contain.
  }
}

module.exports = Loan;
