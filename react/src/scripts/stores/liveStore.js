'use strict'

import Reflux from 'reflux'
import a from '../actions'
//this unit assumes socket.io.js is loaded outside of bundle (script on index)

class KivaChannel {
    constructor(channelName){
        this.data = []
        this.channelName = channelName
        this.connect()
    }
    connect(){
        var endpoint = 'http://streams.kiva.org:80/'
        this.channel = io.connect(endpoint + this.channelName)
        this.channel.on('connect', this.onConnect.bind(this))
        this.channel.on('message', this.receivedMessage.bind(this))
    }
    onConnect(){
        console.log(`Connected to channel ${this.channelName} ...`)
    }
    receivedMessage(data){
        data = JSON.parse(data)
        this.data.push({received: new Date(), data})
        this.processData(data)
        console.log(`Server message on channel ${this.channelName}:`, data)
    }
    processData(data){}
}

//these are not the most reusable. they should not have any kivaloans references.
class LoanPostedChannel extends KivaChannel {
    constructor(){ super('loan.posted') }
    processData(data){
        kivaloans.queueNewLoanNotice(data.p.loan.id)
    }
}

class LoanPurchasedChannel extends KivaChannel {
    constructor(){ super('loan.purchased') }
    processData(data){
        kivaloans.queueToRefresh(data.p.loans.select(l=>l.id))
        //on the chance that they found the loan on KL, but completed on Kiva without closing it,
        if (kla_features.notify && data.p.lender.public && data.p.lender.publicId == kivaloans.lender_id){
            var loans = data.p.loans.select(l=>l.id)
            kivaloans.lender_loans = kivaloans.lender_loans.concat(loans)
            callKLAFeature('notify', `I just saw the ${loans.length} loan${loans.length > 1? 's':''} you made!
            The next search you perform with the option to hide your existing loans will exclude your recent purchase.`)
        }
    }
}

window.channels = {}

domready.done(()=>{
    if (!lsj.get('Options').noStream)
        ([new LoanPostedChannel(), new LoanPurchasedChannel()]).forEach(chan => channels[chan.channelName] = chan)
})

//
var liveStore = Reflux.createStore({ init() {} })

export default liveStore
