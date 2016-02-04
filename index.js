"use strict";

var express = require('express')
var app = express()
var proxy = require('express-http-proxy')
var helmet = require('helmet')
var session = require('express-session')

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

var loanChunks = []

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

// views is directory for all template files
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')

app.get('/', function(request, response) {
  response.render('pages/index')
})

//old site bad urls.
app.get('/feed.svc/rss/*', function(request, response){
    response.sendStatus(404)
})

//API
app.get('/loans/start', function(request, response){
    var data = {pages: loanChunks.length}
    response.send(JSON.stringify(data))
})

app.get('/loans/get', function(request, response) {
    var page = parseInt(request.param('page'))
    if (page) {
        if (page > KLPageSplits || page < 1) {
            response.sendStatus(404)
            return
        }
        response.send(JSON.stringify(loanChunks[page - 1]))
    } else {
        response.sendStatus(404)
    }
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

//CATCH ALL
//any page not defined in this file gets routed to everything which redirects to /#/search
app.get('/*', function(request, response) {
    response.render('pages/everything') //can i do permanent redirect?
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
 */

var kivaloans
var loansChanged = false

setInterval(tempFixReInitKivaLoans, 24*60*60000)
tempFixReInitKivaLoans()

function tempFixReInitKivaLoans(){
    kivaloans = new k.Loans(5*60*1000)
    var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true}) //todo:second is not implemented yet.
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
    if (!loansChanged) {
        console.log("Nothing changed")
        return
    }
    loansChanged = false //hot loans &
    var allLoans = k.ResultProcessors.unprocessLoans(kivaloans.filter({}, false))
    var chunkSize = Math.ceil(allLoans.length / KLPageSplits)
    loanChunks = allLoans.chunk(chunkSize)
    console.log("Loan chunks ready!")
}

setInterval(prepForRequests, 15000)

function connectChannel(channelName, onEvent) {
    var channel = require('socket.io-client').connect(`http://streams.kiva.org:80/${channelName}`,{'transports': ['websocket']});
    channel.on('connect', function () {console.log(`socket.io channel connect: ${channelName}`)})
    channel.on('error', function (data) {console.log(`socket.io channel error: ${channelName}: ${data}`)})
    channel.on('event', onEvent)
    channel.on('message', onEvent)
    channel.on('disconnect', function () {console.log(`socket.io channel disconnect: ${channelName}`)})
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