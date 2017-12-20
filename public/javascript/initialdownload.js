window.kl_progress = {}

function xhrPartnerTransferComplete() {
    try {
        if (this.status == 200) {
            window.unprocessedPartners = JSON.parse(this.responseText)
        }
    } catch(e) {
        console.error('Error During Partner Transfer Complete:', e)
    }
}
function xhrPartnerBail(){
    window.partnerDownloadStarted = false
}
window.lenderLoans = {}
window.doLoadProgress = false

var options = localStorage.getItem("Options")
if (options) options = JSON.parse(options)
var doKLLoad = !(options && options.loansFromKiva)
if (doKLLoad) {
    var xhrP = new XMLHttpRequest();
    xhrP.addEventListener("load", xhrPartnerTransferComplete);
    xhrP.addEventListener("error", xhrPartnerBail);
    xhrP.addEventListener("abort", xhrPartnerBail);
    window.partnerDownloadStarted = true
    xhrP.open("GET", '/api/partners');
    xhrP.send();

    for (var i = 1; i <= kl_api_start.pages; i++) {
        var xhr = new XMLHttpRequest();
        var prog_obj = {page: i, xhr: xhr, loaded: 0, total: kl_api_start.loanLengths[i], response: null}
        kl_progress[i] = prog_obj
        xhr.prog_obj = prog_obj
        xhr.addEventListener("load", function(){
            if (this.status == 200) {
                this.prog_obj.response = JSON.parse(this.responseText)
                this.prog_obj.loaded = this.prog_obj.total
                this.prog_obj.downloaded = true
                if (window.kl_loan_progressUpdate)
                    kl_loan_progressUpdate(this.prog_obj.page, this.prog_obj.total)
                delete this.prog_obj.xhr
            } //todo: reload?
        });
        xhr.addEventListener("progress", function(e) {
            this.prog_obj.loaded = e.loaded
            if (window.kl_loan_progressUpdate)
                kl_loan_progressUpdate(this.prog_obj.page, e.loaded)
        });
        xhr.open("GET", '/api/loans/'+kl_api_start.batch + '/'+ i);
        xhr.send();
    }
}

var doKLLenderLoans = false; // (options && !options.lenderLoansFromKiva && options.kiva_lender_id)
if (doKLLenderLoans){
    window.lenderLoans[options.kiva_lender_id] = {downloadStarted: true}
    var xhrLL = new XMLHttpRequest();
    xhrLL.addEventListener("load", function(){
        if (xhrLL.status == 200)
            window.lenderLoans[options.kiva_lender_id].unprocessedIds = JSON.parse(this.responseText)
    });
    xhrLL.addEventListener("error", function(){
        delete window.lenderLoans[options.kiva_lender_id]
        alert("Your portfolio loans failed to download. If this problem persists, go to Options and enable the option to download your portfolio loans directly from Kiva.")
    });
    xhrLL.open("GET", '/api/lender/'+ options.kiva_lender_id + '/loans/fundraising');
    setTimeout(function(){xhrLL.send()},70)
}
