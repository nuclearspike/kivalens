import extend from 'extend'

// const kivaLoanDynFields = ['status', 'funded_amount', 'basket_amount', 'tags']; // PLUS
// const s_unknown = 'unknown';
// const s_kvSummary = 'kiva_summary';
// const s_kvDetail = 'kiva_detail';
// const s_kl = 'kl';

/**
 * This isn't used. the API doesn't spit out Loan objects, just anonymous objects
 */

class Loan {
  constructor(remote_loan) {
    this.kl_created = Date.now()
    this.kl_processed = new Date()
    extend(this, remote_loan)
  }

  kl_posted_hours_ago() {
    return (new Date() - this.kl_posted_date) / (60 * 60 * 1000)
  }

  kl_dollars_per_hour() {
    return (
      (this.funded_amount + this.basket_amount) / this.kl_posted_hours_ago()
    )
  }

  kl_expiring_in_days() {
    // today is not defined
    return (
      (this.kl_planned_expiration_date - Date.now()) / (24 * 60 * 60 * 1000)
    )
  }

  kl_disbursal_in_days() {
    // today is not defined
    return (
      (new Date(this.terms.disbursal_date) - Date.now()) / (24 * 60 * 60 * 1000)
    )
  }

  getPartner() {
    throw new Error('Do not use getPartner()')
    // todo: this should not reference kivaloans...
    // if (!this.kl_partner)
    //   this.kl_partner = kivaloans.getPartner(this.partner_id);
    // return this.kl_partner;
  }
}

export default Loan
