//unfinished.

const kivaLoanDynFields = ['status','funded_amount','basket_amount','tags']
const s_unknown = 'unknown', s_kvSummary = 'kiva_summary', s_kvDetail = 'kiva_detail', s_kl = 'kl'

//hmmm... just thinking through what the world would look like with this in place.
class Loan {
    constructor(){
        this.kl_created = Date.now()
        this.source = s_unknown
    }
    readFromCommon(c){
        this.id = c.id
        this.status = c.status
        this.posted_date = c.posted_date
    }
    readFromKL(KLLoan){
        this.source = s_kl

    }
    readSummaryFromAPI(apiLoan){
        this.source = s_kvSummary
    }
    readDetailsFromAPI(apiLoan){
        this.source = s_kvDetail
    }
    updateDynamicFieldsFromAPI(apiLoan){
        kivaLoanDynFields.forEach(field => {
            if (this[field] != apiLoan[field]){
                this[field] = apiLoan[field]
                this.kl_dynUpdated = Date.now()
            }
        })
    }
    transformToDownload(){
        //return a cloned object with only what a download object should contain.
    }
}