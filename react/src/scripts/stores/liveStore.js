'use strict'

import Reflux from 'reflux'
import a from '../actions'
//this unit assumes socket.io.js is loaded (script on index)

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
        this.data.push({received: new Date(), data: data})
        this.processData(data)
        console.log(`Server message on channel ${this.channelName} data`, data)
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
    }
}

window.channels = {}

$(()=>{
    ([new LoanPostedChannel(), new LoanPurchasedChannel()]).forEach(chan => channels[chan.channelName] = chan)
})

var liveStore = Reflux.createStore({ init() {} })

export default liveStore
