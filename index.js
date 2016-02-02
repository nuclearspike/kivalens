"use strict";

var express = require('express')
var app = express()
var proxy = require('express-http-proxy')
var helmet = require('helmet')
var session = require('express-session')

//some security
app.use(helmet())

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

var loans = JSON.stringify([])

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

app.get('/loans', function(request, response) {
    response.send(loans)
})

app.get('/fetchloans'), function(request, response){
    fetchLoans()
    response.send("started")
}

//any page not defined in this file gets routed to everything which redirects to /#/search
app.get('/*', function(request, response) {
    response.render('pages/everything') //can i do permanent redirect?
})

app.listen(app.get('port'), function() {
  console.log('KivaLens Server is running on port', app.get('port'))
})

var k = require('./react/src/scripts/api/kiva')

//get all loans.
function fetchLoans() {


    const LoansSearch = k.LoansSearch
    k.setAPIOptions({app_id: 'org.kiva.kivalens'})

    new LoansSearch({}, true, null, true).start().done(allLoans => {
        console.log("Loans received!")
        allLoans.forEach(loan => {
            loan.description.languages.where(lang => lang != 'en').forEach(lang => delete loan.description.texts[lang])
            delete loan.terms.local_payments
            delete loan.journal_totals
            delete loan.translator
            delete loan.location.geo
        })
        loans = JSON.stringify(allLoans)
        console.log("Loans ready!")
    })
}
//require("./MongoTest")