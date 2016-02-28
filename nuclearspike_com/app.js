"use strict"
var express = require('express')
var app = express()
var serveStatic = require('serve-static')

app.use(serveStatic(__dirname + '/public', {maxAge: '1d'}))

app.get("/", (req,res)=>{
    res.sendFile(__dirname +'/public/index.htm')
})

app.get("/nuclearspike.swf", (req,res)=>{
    res.sendFile(__dirname +'/public/nuclearspike.swf')
})

app.get('/*', function(req, res) {
    res.redirect("http://www.kivalens.org/#/search")
})

module.exports = app