"use strict";

var express = require('express')
var app = express()
var proxy = require('express-http-proxy')
var helmet = require('helmet')
var extend = require('extend')
var zlib = require('zlib')

//var session = require('express-session')

var compression = require('compression')

// compress all requests
app.use(compression())

//some security
app.use(helmet())

//shouldn't be in server file.
var k = require('./react/src/scripts/api/kiva')
const KLPageSplits = k.KLPageSplits

/**
app.use(express.compress())
app.use(express.json())
app.use(express.urlencoded())
app.use(express.bodyParser())
app.use(express.methodOverride())
app.use(express.cookieParser())
**/

//session stuff (unused at this point)
//app.set('trust proxy', 1) // trust first proxy
/** app.use( session({
        secret : 'k15yWt1w2k5M45Wrb1V02PzBqXuBjUsN', //switch to heroku config once I use this in prod.
        name : 'sessionId',
    })
)**/

const blankResponse = {loanChunks:[], partners: [], newestTime: null, descriptions:[]}
var loansToServe = {0: extend({},blankResponse)} //start empty.
var latest = 0

//TODO: RESTRICT TO SAME SERVER?
const proxyHandler = {
    forwardPath: function(req, res) {
        return require('url').parse(req.url).path;
    },
    intercept: function(rsp, data, req, res, callback){
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');

        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
            res.send(200)
        } else {
            callback(null,data)
        }
    }
}

//PASSTHROUGH
app.use('/proxy/kiva', proxy('https://www.kiva.org', proxyHandler))
app.use('/proxy/gdocs', proxy('https://docs.google.com', proxyHandler))

app.set('port', (process.env.PORT || 3000))

app.use(express.static(__dirname + '/public'))

//old site bad urls.
app.get('/feed.svc/rss/*', function(request, response){
    response.sendStatus(404)
})

//API
app.get('/start', function(request, response){
    var data = {pages: loansToServe[latest].loanChunks.length, batch: latest, newestTime: loansToServe[latest].newestTime}
    response.send(JSON.stringify(data))
})

app.get('/loans', function(request, response) {
    var batch = parseInt(request.query.batch)
    if (!loansToServe[batch]) {
        response.sendStatus(404)
        return
    }
    var page = parseInt(request.query.page)
    var toServe = loansToServe[batch].loanChunks[page - 1]
    if (!toServe) {
        response.sendStatus(404)
    } else {
        response.send(toServe)
    }
})

app.get('/partners', function(request,response){
    //don't use 'batch' since it just serves all at once and we want the most recent.
    response.send(loansToServe[latest].partners)
})

app.get('/loans/descriptions', function(request,response){
    var batch = parseInt(request.query.batch)
    if (!loansToServe[batch]) {
        response.sendStatus(404)
        return
    }
    var page = parseInt(request.query.page)
    var toServe = loansToServe[batch].descriptions[page - 1]
    if (!toServe) {
        response.sendStatus(404)
    } else {
        response.send(toServe)
    }
})

app.get('/loans/since', function(request, response){
    var newestTime = parseInt(request.query.newestTime)
    if (!newestTime){
        response.sendStatus(404)
        return
    }
    var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > newestTime)
    response.send(JSON.stringify(k.ResultProcessors.unprocessLoans(loans)))
})

app.get('/loans/filter', function(req, resp){
    //getUrl("http://www.kivalens.org/loans/filter?crit=" + encodeURIComponent(JSON.stringify({loan:{name:"Paul"}})),true).done(r => console.log(r))
    var crit = req.param("crit")
    if (crit)
        crit = JSON.parse(decodeURIComponent(crit))
    //var results = k.ResultProcessors.unprocessLoans(kivaloans.filter(crit, false))
    var results = kivaloans.filter(crit, false).select(l=>l.id)
    resp.send(JSON.stringify(results))
    //console.log(crit,results)
})

//CATCH ALL this will also redirect old image reqs to a page though...
app.get('/*', function(request, response) {
    response.redirect("/#/search")
})

app.listen(app.get('port'), function() {
  console.log('KivaLens Server is running on port', app.get('port'))
})

//to satisfy kiva.js
global.cl = function(){}

require('./react/src/scripts/linqextras')

/**
 * issues: partners don't get updated after initial load.
 * so it just reinitializes after 24 hours of constant running
 * it should re-download partners and atheist list on some schedule
 * in the client as well for long-running clients (some are open for weeks!)
 */

var kivaloans
var loansChanged = false

setInterval(tempFixReInitKivaLoans, 24*60*60000)
tempFixReInitKivaLoans()

function tempFixReInitKivaLoans(){
    kivaloans = new k.Loans(5*60*1000)
    var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true})
    kivaloans.init(null, getOptions, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
        if (progress.loan_load_progress && progress.loan_load_progress.label)
            console.log(progress.loan_load_progress.label)
        if (progress.loans_loaded || progress.background_added || progress.background_updated || progress.loan_updated || progress.loan_not_fundraising || progress.new_loans)
            loansChanged = true
        if (progress.loans_loaded)
            prepForRequests()
    })
}

function prepForRequests(){
    if (!kivaloans.isReady()){
        console.log("kivaloans not ready")
        return
    }
    if (!loansChanged) {
        console.log("Nothing changed")
        return
    }
    loansChanged = false //hot loans &
    let prepping = extend({},blankResponse)

    kivaloans.loans_from_kiva.removeAll(l=>l.status!='fundraising')
    var allLoans = k.ResultProcessors.unprocessLoans(kivaloans.loans_from_kiva)
    //additional unprocessing and collecting descriptions
    var descriptions = []
    allLoans.forEach(loan => {
        descriptions.push({id: loan.id, t: loan.kls_use_or_descr_arr}) //only need to do descr... use already there.
        delete loan.description.texts.en
        delete loan.kls_use_or_descr_arr
    })
    var chunkSize = Math.ceil(allLoans.length / KLPageSplits)
    prepping.newestTime = kivaloans.loans_from_kiva.max(l=>l.kl_processed.getTime())
    prepping.loanChunks = allLoans.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
    prepping.partners = JSON.stringify(kivaloans.partners_from_kiva)
    prepping.descriptions = descriptions.chunk(chunkSize).select(chunk => JSON.stringify(chunk))

    loansToServe[++latest] = prepping //must make a copy.
    //delete the old batches.
    Object.keys(loansToServe).where(key => key < latest - 3).forEach(key => delete loansToServe[key])
    console.log(`Loan chunks ready! Chunks: ${prepping.loanChunks.length} Batch: ${latest} Cached: ${Object.keys(loansToServe).length}`)
}

setInterval(prepForRequests, 60000)

//live data stream over socket.io
function connectChannel(channelName, onEvent) {
    var channel = require('socket.io-client').connect(`http://streams.kiva.org:80/${channelName}`,{'transports': ['websocket']});
    //channel.on('connect', function () {console.log(`socket.io channel connect: ${channelName}`)})
    channel.on('error', function (data) {console.log(`socket.io channel error: ${channelName}: ${data}`)})
    //channel.on('event', onEvent)
    channel.on('message', onEvent)
    //channel.on('disconnect', function () {console.log(`socket.io channel disconnect: ${channelName}`)})
}

connectChannel('loan.posted', function(data){
    data = JSON.parse(data)
    console.log("!!! loan.posted")
    loansChanged = true
    if (kivaloans)
        kivaloans.queueNewLoanNotice(data.p.loan.id)
})

connectChannel('loan.purchased', function(data){
    data = JSON.parse(data)
    console.log("!!! loan.purchased")
    loansChanged = true
    if (kivaloans)
        kivaloans.queueToRefresh(data.p.loans.select(l=>l.id))
})