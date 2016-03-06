"use strict";

/**
 *
 * CLUSTER
 *
 * this file contains code for both the master as well as the worker processes.
 * The master does all of the downloading from kiva, the workers do all of the
 * servicing of the requests to users of KivaLens.
 *
 * The master has the socket open to kiva for listening to changes to loans and it updates
 * and adds new ones accordingly. Once a minute if anything has changed, it packages all the loans
 * up into gzipped files of stringified json, ready to be streamed to the client. When the clients
 * download a batch of files, it then requests all changes since the batch was produced to guarantee
 * freshness.
 *
 * When the server first starts up, the master uses ejs to compile the index based on the hashes of the
 * css/js files. /javascript/29383u413984/build.js so that the cache can be set to hold for a year
 * since as soon as it changes, it won't be considered the same file anymore. but EJS is kinda crappy
 * to run every time since the pages aren't built unique per request. So, I just generate index once
 * at master startup and then each time a new batch is prepared (some data is written to index)
 *
 * memwatch is very useful to run the garbage collection after actions that are known to shift
 * around a lot of objects otherwise my hobby-level heroku server runs out of memory.
 *
 * cluster-hub was found to be the best way to call code on the main process and have a callback
 * to receive the data to send it back to the client. I looked at a number of options and either
 * the callbacks didn't work at all or it seemed to be lossy in it's abilities.
 *
 */

//both master and workers need these.
var Hub = require('cluster-hub')
var hub = new Hub()
var cluster = require('cluster')
var memwatch = require('memwatch-next')
var fs = require('fs')
var extend = require('extend')

const mb = 1024 * 1024
function formatMB(bytes){
    return Math.round(bytes / mb)
}

function outputMemUsage(event){
    var mem = process.memoryUsage().rss
    console.log(event, `${formatMB(mem)}MB`, `uptime: ${process.uptime()}`)
}

//important only because heroku has memory limits and doing a gc lets me stay under and run more processes.
//it only takes a fraction of a second anyway.
function doGarbageCollection(name,log){
    if (log) {
        var u_before = process.uptime()
        var m_before = process.memoryUsage()
        memwatch.gc()
        var m_after = process.memoryUsage()
        var u_after = process.uptime()
        console.log(`### ${name}: gc: before: ${formatMB(m_before.rss)}MB - ${formatMB(m_before.rss - m_after.rss)}MB = ${formatMB(m_after.rss)}MB time: ${(u_after - u_before).toFixed(3)}`)
    } else
        memwatch.gc()
}

function notifyAllWorkers(msg){ //todo: cluster-hub has a method to send to all workers.
    Object.keys(cluster.workers).forEach(id => cluster.workers[id].send(msg))
}

var startResponse = {pages: 0, batch: 0}
var startResponseHistory = []

function hashFile(fn, fo, cb) {
    // the file you want to get the hash
    var crypto = require('crypto')
    var fd = fs.createReadStream(fn)
    var hash = crypto.createHash('sha1')
    hash.setEncoding('hex')

    fd.on('end', function () {
        hash.end()
        fo.hash = hash.read()
        cb() // the desired sha1sum
    })
    fd.pipe(hash)
}

if (cluster.isMaster){ //preps the downloads
    const blankResponse = {loanChunks:'', newestTime:null, descriptions:''}
    var partnersGzipped = false
    var ejs = require('ejs')
    var loansToServe = {0: extend({},blankResponse)} //start empty.
    var latest = 0
    const redis = require('redis')
    const rc = redis.createClient(process.env.REDISTOGO_URL)

    const vision = require('node-cloud-vision-api')
    //limited to my home IP. todo: make heroku config and set google vision to allow heroku ip
    if (process.env.VISION_API_KEY)
        vision.init({auth: process.env.VISION_API_KEY})
    else
        console.log("NO VISION API KEY. GOOGLE CLOUD VISION CALLS WILL FAIL.")

    const ResultProcessors = require("./react/src/scripts/api/kivajs/ResultProcessors")

    //RENDER INDEX
    const regenIndex = function(start) {
        fs.readFile(__dirname + '/views/pages/index.ejs', (err, buffer)=> {
            //starts with random hash just to make it always in a working state.
            var hash = Math.round(Math.random() * 100000000)
            var css = [{name: 'application', hash}, {name: 'snowstack', hash}]
            var js = [{name: 'initialdownload',hash},{name: 'vendor', hash}, {name: 'build', hash}]
            var todo = css.length + js.length
            const renderIndex = () => {
                if (--todo) return //if it has anything left to do, leave.
                var index = ejs.render(buffer.toString(), {js, css, start}, {})
                fs.writeFile(__dirname + '/public/index.html', index, x => {
                    console.log("## rendered index!")
                })
            }
            css.forEach(fo => {
                hashFile(__dirname + '/public/stylesheets/' + fo.name + '.min.css', fo, renderIndex)
            })
            js.forEach(fo => {
                hashFile(__dirname + '/public/javascript/' + fo.name + '.js', fo, renderIndex)
            })
        })
    }
    regenIndex({batch: 0, pages: 0}) //files aren't ready to serve yet, instructs client to go to Kiva.

    outputMemUsage("STARTUP")
    console.log("STARTING MASTER")
    var zlib = require('zlib')
    const gzipOpt = {level : zlib.Z_BEST_COMPRESSION}

    const numCPUs = require('os').cpus().length
    console.log("*** CPUs: " + numCPUs)
    for (var i=0; i< Math.min(numCPUs-1, 7); i++)
        cluster.fork()

    // Listen for dying workers
    cluster.on('exit', worker => {
        console.log('INTERESTING: Worker %d died :(', worker.id)
        cluster.fork()
    })

    /**
     * rc.keys('vision_label_*',function(err,response){console.log(err,response)})
     *
     * const redis = require('redis')
     const rc = redis.createClient('redis://redistogo:<newpass>@grouper.redistogo.com:10786/')

     rc.keys('*',function(err,response){
    console.log(response)
    rc.mget(response,function(err2,response2){console.log(err2,response2)})
})
     */
    const doVisionLookup = (loan_id, callback) => {
        if (typeof callback !== 'function') callback = () => true
        var loan = kivaloans.getById(loan_id)
        if (!loan) {
            callback(404)
            return
        }

        //we've looked it up previously.
        if (loan.kl_visionLabels) {
            callback(null,loan.kl_visionLabels)
            return
        }

        var vlkey = `vision_label_${loan_id}`
        rc.get(vlkey,(err,result) => {
            if (result){
                console.log("found redis key: ", loan_id)
                callback(null, loan.kl_visionLabels = JSON.parse(result))
            } else {
                const req = new vision.Request({
                    image: new vision.Image({url: `https://www.kiva.org/img/orig/${loan.image.id}.jpg`}),
                    features: [new vision.Feature('LABEL_DETECTION', 10)]
                })

                console.log(`Making Vision API request: ${loan_id}`)
                vision.annotate([req]).then(res => {
                    // handling response for each request
                    loan.kl_visionLabels = res.responses[0].labelAnnotations
                    if (loan.kl_visionLabels) {
                        console.log(`Vision API result: ${loan_id}`)
                        callback(null, loan.kl_visionLabels)
                    } else {
                        console.log(`Vision API NO result: ${loan_id}`)
                        loan.kl_visionLabels = [] //prevents lookup next time.
                        callback(404)
                    }
                    rc.set(vlkey, JSON.stringify(loan.kl_visionLabels))
                    rc.expire(vlkey,'2592000') //30 days
                }, e => {
                    callback(404)
                    console.log('Error: ', e)
                })
            }
        })
    }

    const removeVisionFromRedis = loan_id => rc.del(`vision_label_${loan_id}`)

    //upon first load, we pull the data out of redis and attach it to the loans... so that we can eventually do filtering on it or pass them down in a separate request
    const pullVisionFromFromRedis = () => {
        rc.keys('vision_label_*',(err,keys)=>{
            var loans_with_data = kivaloans.loans_from_kiva.where(loan=>!loan.kl_visionLabels && keys.indexOf(`vision_label_${loan.id}`) > -1)
            var keys_to_fetch = loans_with_data.select(loan => `vision_label_${loan.id}`)
            rc.mget(keys_to_fetch, (err, values)=>{
                if (!err){
                    console.log(`Found ${values.length} vision labels from redis`)
                    loans_with_data.zip(values, (loan, value)=> loan.kl_visionLabels = JSON.parse(value))
                }
            })
            //how many are in redis that are gone? this should delete, too...
            //var deadKeys = keys.where(k=> keys_to_fetch.indexOf(k) == -1) THIS IS NOT CORRECT. keys_to_fetch doesn't indicate which are dead. this needs to find the keys that aren't in kivaloans
            //deadKeys.forEach(key => rc.del(key))
        })
        setInterval(function(){
            kivaloans.filter({loan:{sort:'newest'}}).where(loan=>!loan.kl_visionLabels).take(100).forEach(loan=>doVisionLookup(loan.id))
        },60000)
    }

    hub.on("vision-loan", (loan_id, sender, callback) => doVisionLookup(loan_id, callback))

    hub.on("vision-all", (ignore, sender, callback) => {
        callback(null,kivaloans.filter({loan:{}}).where(loan=>loan.kl_visionLabels).select(loan=>({id: loan.id, kl_visionLabels: loan.kl_visionLabels})))
    })

    /**
     * get the updates since given batch number
     */
    hub.on("since", (batch, sender, callback) => {
        if (!loansToServe[batch]) {
            callback('[]')
            return
        }
        var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > loansToServe[batch].newestTime)
        if (loans.length > 500) {
            //todo: make a better way to find changes than kl_processed since that gets reset on background resync
            console.log(`INTERESTING: loans/since count: ${loans.length}: NOT SENDING`)
            callback('[]')
            return
        }
        console.log(`INTERESTING: loans/since count: ${loans.length}`)
        callback(JSON.stringify(ResultProcessors.unprocessLoans(loans)))
    })

    var k = require('./react/src/scripts/api/kiva')

    /**
     * filter takes a client crit object and returns the ids that match.
     */
    hub.on('filter', (crit, sender, callback) => {
        callback(JSON.stringify(kivaloans.filter(crit).select(l=>l.id)))
    })

    hub.on('rss', (crit, sender, callback) => {
        callback(JSON.stringify(ResultProcessors.unprocessLoans(kivaloans.filter(crit))))
        var rss_crit = JSON.stringify(crit) //?why did it ever parse?
        var key = `rss_fetch_${rss_crit}`
        rc.incr(key) //creates if not present.
        rc.expire(key,'86400') //24 hours...
    })

    /**
     * get all of the fundraising ids for a given lender.
     */
    hub.on('lenderloans', (lenderid, sender, callback) => {
        console.log("INTERESTING: lenderloans", lenderid)
        const LenderFundraisingLoans = require("./react/src/scripts/api/kivajs/LenderFundraisingLoans")

        const storeLenderInRedis = toStore => {
            var key = `lender_${lenderid}`
            rc.set(key,JSON.stringify(toStore))
            rc.expire(key,'2592000') //30 days
        }

        req.kiva.api.lender(lenderid)
            .fail(x => callback(404))
            .done(lenderObj => {
                rc.get(`lender_${lenderid}`,(err,c_lender)=>{
                    var needs_refetch = true,
                        to_store = {loan_count: lenderObj.loan_count, fundraising_loans :[]}
                    if (!err && c_lender){
                        //cached lender exists
                        c_lender = JSON.parse(c_lender)
                        needs_refetch = c_lender.loan_count != lenderObj.loan_count
                        if (!needs_refetch){
                            if (c_lender.fundraising_loans && Array.isArray(c_lender.fundraising_loans) && kivaloans.isReady()){
                                to_store.fundraising_loans.removeAll(id => !kivaloans.getById(id))
                            }
                            to_store.fundraising_loans = c_lender.fundraising_loans
                            callback(null, to_store.fundraising_loans)
                            storeLenderInRedis(to_store)
                        }
                    }

                    if (needs_refetch){
                        new LenderFundraisingLoans(lenderid).ids()
                            .done(ids => {
                                to_store.fundraising_loans = ids
                                callback(null, to_store.fundraising_loans)
                                storeLenderInRedis(to_store)
                            })
                            .fail(x => callback(404))
                    }
                })
            })

    })

    hub.on('heartbeat', (settings, sender, callback)=>{
        //the limitation here is when there are multiple tabs open to KL and each are posting the heartbeat (and have different uptimes)
        var key = `heartbeat_${settings.install}_${settings.lender}`
        rc.set(key, JSON.stringify(settings))
        rc.expire(key,'360') //6 minutes...

        rc.set('on_past_24h_'+ key, JSON.stringify(settings))
        rc.expire('on_past_24h_'+ key,'86400') //24 hours...

        callback(200)
    })

    const KLPageSplits = 4
    k.setAPIOptions({max_concurrent:20})

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


    kivaloans = new k.Loans(5*60*1000)
    var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true})
    kivaloans.init(null, getOptions, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
        if (progress.loan_load_progress && progress.loan_load_progress.label)
            console.log(progress.loan_load_progress.label)
        if (progress.loan_not_fundraising)
            removeVisionFromRedis(progress.loan_not_fundraising.id)
        if (progress.new_loans)
            progress.new_loans.forEach(loan => doVisionLookup(loan.id))
        if (progress.loans_loaded || progress.background_added || progress.background_updated || progress.loan_updated || progress.loan_not_fundraising || progress.new_loans)
            loansChanged = true
        if (progress.loans_loaded || (progress.backgroundResync && progress.backgroundResync.state == 'done'))
            prepForRequests()
        if (progress.loans_loaded) //should happen after prep for requests to not slow down server boot.
            pullVisionFromFromRedis()
    })

    const prepForRequests = function(){
        if (!kivaloans.isReady()) {
            //console.log("kivaloans not ready")
            return
        }
        if (!loansChanged) {
            //console.log("Nothing changed")
            return
        }

        outputMemUsage('prepForRequests')

        loansChanged = false //hot loans &
        var prepping = extend({}, blankResponse)

        kivaloans.loans_from_kiva.removeAll(l=>l.status != 'fundraising')
        var allLoans = ResultProcessors.unprocessLoans(kivaloans.loans_from_kiva)
        //additional unprocessing and collecting descriptions
        var descriptions = []
        allLoans.forEach(loan => {
            descriptions.push({id: loan.id, t: loan.kls_use_or_descr_arr}) //only need to do descr... use already there.
            delete loan.description //.texts.en
            delete loan.kls_use_or_descr_arr
            if (!loan.kls_age) delete loan.kls_age
            delete loan.lender_count
            if (!loan.funded_amount) delete loan.funded_amount
            if (!loan.basket_amount) delete loan.basket_amount
            if (!loan.kls_tags.length) delete loan.kls_tags
            delete loan.terms.repayment_term
            loan.klb = {}
            loan.borrowers.groupByWithCount(b=>b.gender).forEach(g=>loan.klb[g.name] = g.count)
            delete loan.borrowers
            delete loan.terms.loss_liability.currency_exchange_coverage_rate
            delete loan.borrower_count
            delete loan.payments
            delete loan.status
            delete loan.terms.scheduled_payments
            loan.kls = true
        })
        var chunkSize = Math.ceil(allLoans.length / KLPageSplits)
        prepping.newestTime = kivaloans.loans_from_kiva.max(l=>l.kl_processed.getTime())
        var bigloanChunks = allLoans.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.loanChunks = Array.range(0, KLPageSplits).select(x=>false)
        var bigDesc = descriptions.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.descriptions = Array.range(0, KLPageSplits).select(x=>false)

        const writeBuffer = function(name, buffer, cb){
            var fn = `/tmp/${name}.kl`
            fs.writeFile(fn, buffer, function(err) {
                if (err) return console.log(err)
                cb()
            })
        }

        function finishIfReady(){
            //don't know when prepping isn't there, but there was an error in the logs that it was undefined here and crashed master.
            if (prepping && prepping.loanChunks.all(c=>c) && prepping.descriptions.all(c=>c) && partnersGzipped) {
                outputMemUsage("Master finishIfReady start")
                loansToServe[latest] = prepping //must make a copy.
                //delete the old batches.
                Object.keys(loansToServe).where(batch => batch < latest - 10).forEach(batch => {
                    if (batch > 0)
                        Array.range(1,KLPageSplits).forEach(page => {
                            fs.unlink(`/tmp/loans-${batch}-${page}.kl`)
                            fs.unlink(`/tmp/descriptions-${batch}-${page}.kl`)
                        })
                    delete loansToServe[batch]
                })
                console.log(`Loan chunks ready! Chunks: ${prepping.loanChunks.length} Batch: ${latest} Cached: ${Object.keys(loansToServe).length}`)

                var startResponse = {batch: latest, pages: prepping.loanChunks.length, loanLengths: prepping.loanChunks, descrLengths: prepping.descriptions}
                var message = { downloadReady: JSON.stringify(startResponse)}
                doGarbageCollection("Master finishIfReady: before notify")
                notifyAllWorkers(message)
                regenIndex(startResponse)

                bigloanChunks = undefined
                bigDesc = undefined
                message = undefined
                prepping = undefined
                doGarbageCollection("Master finishIfReady: after notify", true)
            }
        }

        latest++

        zlib.gzip(JSON.stringify(kivaloans.partners_from_kiva), gzipOpt, function (_, result) {
            writeBuffer('partners', result, x=>{
                partnersGzipped = true
                finishIfReady()
            })
        })

        bigloanChunks.map((chunk, page) => { //map to give index
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                writeBuffer(`loans-${latest}-${page+1}`, result ,x=>{
                    prepping.loanChunks[page] = chunk.length
                    finishIfReady()
                })
            })
        })

        bigDesc.map((chunk, page) => {
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                writeBuffer(`descriptions-${latest}-${page+1}`, result, x=>{
                    prepping.descriptions[page] = chunk.length
                    finishIfReady()
                })
            })
        })
    }

    setInterval(prepForRequests, 60000)

    //live data stream over socket.io
    var channels = []
    const connectChannel = function(channelName, onEvent) {
        console.log("connecting to socket.io channel " + channelName)
        try {
            var channel = require('socket.io-client').connect(`http://streams.kiva.org:80/${channelName}`, {'transports': ['websocket']});
            channel.on('error', function (data) {
                console.log(`socket.io channel error: ${channelName}: ${data}`)
            })
            channel.on('message', onEvent)
            channels.push(channel)
        } catch(e){
            console.error('socket.io error: ', e)
        }
    }
    if (process.env.NODE_ENV == 'production') {
        connectChannel('loan.posted', function (data) {
            data = JSON.parse(data)
            if (kivaloans)
                kivaloans.queueNewLoanNotice(data.p.loan.id)
        })

        connectChannel('loan.purchased', function (data) {
            data = JSON.parse(data)
            var ids = data.p.loans.select(l=>l.id)
            if (kivaloans)
                kivaloans.queueToRefresh(ids)
        })
    } else {
        console.log("not connecting to live stream socket.io channels.")
    }
}
else  //workers handle all communication with the clients.
{
    console.log("STARTING WORKER")
    var express = require('express')
    var app = express()
    var proxy = require('express-http-proxy')
    var helmet = require('helmet')
    var compression = require('compression')
    var serveStatic = require('serve-static')
    var mime = require('mime-types')


    var main = express()

    // compress all requests
    app.use(compression())

    //some security
    app.use(helmet())

    //TODO: RESTRICT TO SAME SERVER?
    const proxyHandler = {
        filter: req => req.xhr, //only proxy xhr requests
        forwardPath: req => require('url').parse(req.url).path,
        intercept: (rsp, data, req, res, callback) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');
            res.set('Set-Cookie', 'ilove=kiva; Path=/; HttpOnly'); //don't pass back kiva's cookies.
            // intercept OPTIONS method
            if ('OPTIONS' == req.method) {
                res.send(200)
            } else {
                callback(null,data)
            }
        }
    }

    const serveGzipFile = (res, fn) =>{
        fn = `/tmp/${fn}.kl`
        try {
            var stats = fs.statSync(fn)
            res.type('application/json;  charset=utf-8')
            res.header('Content-Encoding', 'gzip')
            res.header('Content-Length', stats.size)
            res.header('Cache-Control', `public, max-age=600`) //10 minutes
            res.sendFile(fn)
        } catch(e){
            res.sendStatus(404)
        }
    }

    //alternative method...
    const serveGzipFile2 = (res, size, fn) =>{
        fn = `/tmp/${fn}.kl`
        if (!size) {
            var stats = fs.statSync(fn)
            size = stats.size
        }
        var head = {'Content-Encoding': 'gzip',
            'Content-Type': 'application/json;  charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': size}

        res.writeHead(200, head)

        var readStream = fs.createReadStream(fn)
        readStream.on('data', function(data) {
            res.write(data)
        })

        readStream.on('end', function() {
            res.end()
        })
    }

    const serveHashedAsset = (res, fn, mimetype) => {
        res.type(mimetype)
        res.header('Cache-Control', 'public, max-age=31536000') //1 year
        res.sendFile(fn)
    }

    main.set('port', (process.env.PORT || 5000))

    //PASSTHROUGH
    app.use('/proxy/kiva', proxy('https://www.kiva.org', proxyHandler))
    app.use('/proxy/gdocs', proxy('https://docs.google.com', proxyHandler))

    //app.use(express.static(__dirname + '/public'))

    var setCustomCacheControl = (res, path) => {
        var maxAge = 86400
        switch (mime.lookup(path)){
            case 'text/html': maxAge = 0
                break
            case 'image/png':
            case 'application/javascript':
            case 'text/css' :
                maxAge = 31536000
                break
        }
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`)
    }

    //there's gotta be a smoother/faster way?
    app.get('/javascript/:release/:file', (req,res)=>{
        serveHashedAsset(res, __dirname + '/public/javascript/' + req.params.file, 'application/javascript')
    })

    app.get('/stylesheets/:release/:file', (req,res)=>{
        serveHashedAsset(res, __dirname + '/public/stylesheets/' + req.params.file, 'text/css')
    })

    app.use(serveStatic(__dirname + '/public', {
        maxAge: '1d',  setHeaders: setCustomCacheControl
    }))

    //old site bad urls.
    app.get('/feed.svc/rss/*', (req, res) =>res.sendStatus(410)) //410 = GONE
    app.get('/Redirect.aspx*', (req, res) =>res.sendStatus(410))

    //things i don't have
    app.get("/robots.txt", (req,res)=>res.sendStatus(404))

    app.get('/rss/:criteria', (req, res) =>{
        var crit = req.params.criteria
        if (crit)
        try {
            crit = JSON.parse(decodeURIComponent(crit))
        } catch(e){
            res.sendStatus(404)
            return
        }
        if (!crit.loan) crit.loan = {}
        crit.loan.limit_results = 100

        hub.requestMaster('rss', crit, result => {
            var RSS = require('rss')
            if (!crit.feed) crit.feed = {}
            if (!crit.feed.name) crit.feed.name = crit.feed_name || '(unnamed)'
            if (!crit.feed.link_to) crit.feed.link_to = 'kiva'
            var opts = {
                title: 'KivaLens: ' + crit.feed.name,
                feed_url: `http://www.kivalens.org/rss/${req.params.criteria}`,
                site_url: 'http://www.kivalens.org/#/search'
            }
            var feed = new RSS(opts)
            result = JSON.parse(result)
            result.forEach(loan => {
                feed.item({
                    title: loan.name,
                    description: loan.description.texts.en,
                    guid: loan.id,
                    url: `http://www.kivalens.org/rss_click/${crit.feed.link_to}/${loan.id}`,
                    date: loan.posted_date
                })
            })
            res.type('application/rss+xml')
            res.send(feed.xml())
        })
    })

    app.get('/rss_click/:go_to/:id', (req,res) => {
        var id = req.params.id, go_to = req.params.go_to
        console.log(`INTERESTING: rss_click : ${go_to}: ${id}`)
        if (go_to == 'kiva') { //rss output fills in 'kiva' when none specified
            res.redirect(`https://www.kiva.org/lend/${id}?app_id=org.kiva.kivalens`)
        } else {
            res.redirect(`http://www.kivalens.org/#/search/loan/${id}`)
        }
    })

    //API
    app.get('/api/loans/:batch/:page', (req, res) => {
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(req.params.page)

        serveGzipFile(res, `loans-${batch}-${page}`)
    })

    app.get('/api/partners', function(req,res){
        serveGzipFile(res, 'partners')
    })

    app.get('/api/loans/:batch/descriptions/:page', function(req,res){
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans/descriptions batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(req.params.page)

        serveGzipFile(res, `descriptions-${batch}-${page}`)
    })

    app.get('/api/since/:batch', (req, res) =>{
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        hub.requestMaster('since', batch, result => {
            res.type('application/json')
            res.send(result)
        })
    })

    app.get('/api/lender/:lender/loans/fundraising',(req,res)=>{
        /**
        var t = require('webworker-threads').create()
        //t.load(__dirname + '/react/src/scripts/api/kiva.js')
        t.load(__dirname + '/thread_lenderLoans.js')
        t.on("message", function(event){
            console.log(event)
        })
        t.on("error", function(event){
            console.log(event)
        })
        t.on("data", function(one,two){
            console.log('on data:', one, JSON.parse(two))
        })
        t.eval(`lenderLoans('${req.params.lender}')`, function(err,result){
            console.log('eval returned:',err,result)
        })
        **/
        /**
        var Worker = require('webworker-threads').Worker
        var llw = new Worker('thread_lenderLoans.js')
        llw.onmessage = function(event) {
            console.log('thread returning:',event.data)
            var d = JSON.parse(event.data)
            if (d.ids)
                res.send(d.ids)
            else
                res.sendStatus(404)
        }
        llw.onerror = function(event){
            console.log('ERROR:',event)
        }
        llw.postMessage(req.params.lender)
         **/

        hub.requestMaster('lenderloans', req.params.lender, (err,result) => {
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=300`) //5m todo: is this a bad idea?
                res.send(result)
            }
        })
    })

    app.get("/api/vision/loans", (req,res)=>{
        hub.requestMaster('vision-all', null, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=5`)
                res.send(result)
            }
        })
    })

    app.get("/api/vision/loan/:loan_id", (req,res)=>{
        hub.requestMaster('vision-loan', req.params.loan_id, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=31536000`)
                res.send(result)
            }
        })
    })

    app.get('/api/heartbeat/:install/:lender/:uptime', (req, res)=>{
        hub.requestMaster('heartbeat',
            {install: req.params.install, lender: req.params.lender, uptime: req.params.uptime},
            result => {
                res.status(result)
                res.send(`{"status":${result}}`)
            })
    })

    /**
     * //not used currently.
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({loan:{name:"Paul"}}))},true).done(r => console.log(r))
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({"loan":{"repaid_in_max":5,"still_needed_min":25,"limit_to":{"enabled":false,"count":1,"limit_by":"Partner"}},"partner":{},"portfolio":{"exclude_portfolio_loans":"true","pb_partner":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_country":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_sector":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_activity":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"}},"notifyOnNew":true}))},true).done(r => console.log(r))
     */
    app.get('/api/loans/filter', (req, res) =>{
        var crit = req.query.crit
        if (crit)
            crit = JSON.parse(decodeURIComponent(crit))
        hub.requestMaster('filter', crit, result => res.send(result))
    })


    //CATCH ALL... this will also redirect old image reqs to a page though...
    app.get('/*', (req, res) => {
        //i could test the mime type of the path?
        res.redirect("/#/search")
    })

    var vhost = require('vhost')
    var nspike = require('./nuclearspike_com')

    main.use(vhost('www.nuclearspike.com', nspike)) //use regex instead.
    main.use(vhost('nuclearspike.com', nspike))
    main.use(vhost('nuclearspike.local', nspike)) //serveStatic(__dirname + '/nuclearspike_com/public', {maxAge: '1d'}))

    main.use(vhost('localhost', app))
    main.use(vhost('kivalens.org', app))
    main.use(vhost('www.kivalens.org', app))


    main.listen(main.get('port'), function() {
        console.log('KivaLens Server is running on port', main.get('port'))
    })

    /** JSON Parser, custom deserialization COOL!
    const bufferParse = (key, value) => {
        return value && value.type === 'Buffer'
            ? new Buffer(value.data)
            : value;
    }
    **/

    //worker receiving message... todo: switch to hub.
    process.on("message", msg => {
        if (msg.downloadReady){
            startResponse = JSON.parse(msg.downloadReady)
            var curBatch = startResponse.batch
            startResponseHistory[curBatch] = startResponse
            Object.keys(startResponseHistory).forEach(k=> {
                if (curBatch - k > 2)
                    delete startResponseHistory[k]
            })
            doGarbageCollection(`Worker ${cluster.worker.id} downloadReady `)
        }
    })
}


