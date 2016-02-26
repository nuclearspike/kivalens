'use strict'

var kb = require('./kivajs/kivaBase')
var LoansSearch = require('./kivajs/LoansSearch')

module.exports = function (self) {
    self.addEventListener('message',function(){
        kb.setAPIOptions({app_id:'org.kiva.kivalens'})
        console.log("wwBackgroundResync: started in Worker")
        new LoansSearch({}, false, null, true).start().done(loans => {
            //only select the dynamic fields ...but why status?? it'll always be f-r
            loans = loans.select(l => ({id: l.id, status: l.status, kl_tags: l.kl_tags,
                basket_amount: l.basket_amount, funded_amount: l.funded_amount}))

            console.log("wwBackgroundResync: done in Worker")
            var encoder = new TextEncoder('utf-8')
            var data = encoder.encode(JSON.stringify(loans))
            self.postMessage(data) //can't transfer?
        })
    })
}