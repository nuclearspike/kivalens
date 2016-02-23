'use strict'

var k = require('./kiva.js')

module.exports = function (self) {
    self.addEventListener('message',function(){
        k.setAPIOptions({app_id:'org.kiva.kivalens'})
        console.log("wwBackgroundResync: started in Worker")
        new LoansSearch({}, false, null, true).start().done(loans => {
            //only select the dynamic fields
            loans = loans.select(l => ({id: l.id, status: l.status, kl_tags: l.kl_tags,
                basket_amount: l.basket_amount, funded_amount: l.funded_amount}))

            console.log("wwBackgroundResync: done in Worker")
            var encoder = new TextEncoder('utf-8')
            var data = encoder.encode(JSON.stringify(loans))
            self.postMessage(data) //can't transfer?
        })
    })
}