'use strict'

import Reflux from 'reflux'
import a from '../actions'

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
    constructor(){
        super('loan.posted')
    }
    processData(data){
        kivaloans.newLoanNotice(data.p.loan.id)
    }
}

class LoanPurchasedChannel extends Channel {
    constructor(){
        super('loan.purchased')
    }
    processData(data){
        kivaloans.refreshLoans(data.p.loans.select(l=>l.id))
    }
}

var channels = {}

$(()=>{
    var chans = [LoanPostedChannel, LoanPurchasedChannel]
    chans.forEach(ch => {
        var chan = new ch()
        channels[chan.channelName] = chan
    })
    window.channels = channels
})

var liveStore = Reflux.createStore({
        init() {

        }
    }
)

export default liveStore
