'use strict'

import Reflux from 'reflux'
import a from '../actions'

//when you are on the live page, it doesn't queue the actions and ends up with more API calls
//but goes full real-time
var watchedPot = false

class Channel {
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

class LoanPostedChannel extends Channel {
    constructor(){ super('loan.posted') }
    processData(data){
        if (false && watchedPot && kivaloans.isReady())
            kivaloans.newLoanNotice([data.p.loan.id])
        else
            kivaloans.queueNewLoanNotice(data.p.loan.id)
    }
}

class LoanPurchasedChannel extends Channel {
    constructor(){ super('loan.purchased') }
    processData(data){
        var loan_ids = data.p.loans.select(l=>l.id)
        if (false && watchedPot && kivaloans.isReady())
            kivaloans.refreshLoans(loan_ids)
        else
            kivaloans.queueToRefresh(loan_ids)
    }
}

window.channels = {}
//window.startChannels = ()=> Object.keys(channels).forEach(channel => channels[channel].connect())

$(()=>{
    ([new LoanPostedChannel(), new LoanPurchasedChannel()]).forEach(chan => channels[chan.channelName] = chan)
})

var liveStore = Reflux.createStore({ init() {} })

function setWatchedPot(boil){ watchedPot = boil }

export default liveStore
export {setWatchedPot}
