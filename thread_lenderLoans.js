"use strict"
/**
 * an attempt at having this executed in a thread. it doesn't like
 * kiva.js for whatever reason.
 */
console.log('started thread file')

//self.importScripts('./react/src/scripts/api/kivajs/LenderFundraisingLoans.js')
const LFL = require('./react/src/scripts/api/kivajs/LenderFundraisingLoans')
console.log('required LFL', typeof LFL)

function lenderLoans(lender_id){
    //var LenderFundraisingLoans = require('./react/src/scripts/api/kiva').LenderFundraisingLoans
    console.log("type of ", typeof LFL)
    thread.emit("data", 'processed', {lender_id:lender_id})
    return "BOOK"
}

/**
onmessage = function(event) {
    console.log('thread started',event.data)
    postMessage("foofof:" + event.data)
    /**
    new LenderFundraisingLoans(event.data).ids()
        .done(ids => {
            console.log('done:',ids)
            postMessage(JSON.stringify({status:200, ids: ids}))
        })
        .fail(x=>postMessage(JSON.stringify({status: 404})))

}
**/