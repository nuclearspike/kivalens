"use strict";

/**
 * THIS IS NO LONGER USED. IT HAS ALL BEEN MOVED TO CLUSTER.JS
 * THIS FILE WILL EVENTUALLY DISAPPEAR.
 */

var express = require('express')
var app = express()
var proxy = require('express-http-proxy')
var helmet = require('helmet')
var extend = require('extend')
var zlib = require('zlib')
const util = require('util')
var memwatch = require('memwatch-next')
//
/**
memwatch.on('leak', function(info) {
    console.log(info)
})**/

const gzipOpt = {level : zlib.Z_BEST_COMPRESSION}

//var session = require('express-session')

var compression = require('compression')

// compress all requests
app.use(compression())

//some security
app.use(helmet())

//shouldn't be in server file.
var k = require('./react/src/scripts/api/kiva')
const KLPageSplits = k.KLPageSplits
k.setAPIOptions({max_concurrent:20})


//session stuff (unused at this point)
//app.set('trust proxy', 1) // trust first proxy
/** app.use( session({
        secret : 'k15yWt1w2k5M45Wrb1V02PzBqXuBjUsN', //switch to heroku config once I use this in prod.
        name : 'sessionId',
    })
)**/

const blankResponse = {loanChunks:'', newestTime: null, descriptions:''}
var partnersGzip
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
    response.json({pages: loansToServe[latest].loanChunks.length, batch: latest})
})

app.get('/loans/:batch/:page', function(request, response) {
    var batch = parseInt(request.params.batch)
    if (batch != latest)
        console.log(`INTERESTING: /loans batch: ${batch} latest: ${latest}`)

    if (!loansToServe[batch]) {
        response.sendStatus(404)
        return
    }
    var page = parseInt(request.params.page)
    var toServe = loansToServe[batch].loanChunks[page - 1]
    if (!toServe) {
        response.sendStatus(404)
    } else {
        response.header('Content-Type', 'application/json')
        response.header('Content-Encoding', 'gzip')
        response.send(toServe)
    }
})

app.get('/partners', function(request,response){
    //don't use 'batch' since it just serves all at once and we want the most recent.
    response.header('Content-Type', 'application/json')
    response.header('Content-Encoding', 'gzip')
    response.send(partnersGzip)
})

app.get('/loans/:batch/descriptions/:page', function(request,response){
    var batch = parseInt(request.params.batch)
    if (!loansToServe[batch]) {
        response.sendStatus(404)
        return
    }
    if (batch != latest)
        console.log(`INTERESTING: /loans/descriptions batch: ${batch} latest: ${latest}`)
    var page = parseInt(request.params.page)
    var toServe = loansToServe[batch].descriptions[page - 1]
    if (!toServe) {
        response.sendStatus(404)
    } else {
        response.header('Content-Type', 'application/json');
        response.header('Content-Encoding', 'gzip');
        response.send(toServe)
    }
})

app.get('/since/:batch', function(request, response){
    var batch = parseInt(request.params.batch)
    if (!batch || !loansToServe[batch]){
        response.sendStatus(404)
        return
    }
    var newestTime = loansToServe[batch].newestTime
    var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > newestTime)
    if (loans.length > 1000) {
        //todo: make a better way to find changes than kl_processed since that gets reset on background resync
        console.log(`INTERESTING: loans/since count: ${loans.length}: NOT SENDING`)
        response.json([])
        return
    }
    console.log(`INTERESTING: loans/since count: ${loans.length}`)
    response.json(k.ResultProcessors.unprocessLoans(loans))
})

//req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({loan:{name:"Paul"}}))},true).done(r => console.log(r))
app.get('/loans/filter', function(req, resp){
    var crit = req.query.crit
    if (crit)
        crit = JSON.parse(decodeURIComponent(crit))
    resp.json(kivaloans.filter(crit).select(l=>l.id))
})

//CATCH ALL this will also redirect old image reqs to a page though...
app.get('/*', function(request, response) {
    response.redirect("/#/search")
})

app.listen(app.get('port'), function() {
  console.log('KivaLens Server is running on port', app.get('port'))
})

//to satisfy kiva.js ; hack
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

//temporary fix for memory issue. the restart is so fast and the client is usable before KL
//has all loans loaded... have this not do it every 24 hours, but on an interval check the time
//or when it starts up have it calculate when midnight is and set a timeout.
setInterval(()=>{
    console.log('INTERESTING: restart on interval')
    process.exit(1)
}, 24*60*60000)

//won't the old kivaloans object still exist and keep downloading when a new one is instantiated?

kivaloans = new k.Loans(5*60*1000)
var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true})
kivaloans.init(null, getOptions, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
    if (progress.loan_load_progress && progress.loan_load_progress.label)
        console.log(progress.loan_load_progress.label)
    if (progress.loans_loaded || progress.background_added || progress.background_updated || progress.loan_updated || progress.loan_not_fundraising || progress.new_loans)
        loansChanged = true
    if (progress.loans_loaded || (progress.backgroundResync && progress.backgroundResync.state == 'done'))
        prepForRequests()
})

function outputMemUsage(event){
    console.log(event, util.inspect(process.memoryUsage()), `uptime: ${process.uptime()}`)
}


