"use strict"
var express = require('express')
var app = express()
var serveStatic = require('serve-static')

//why is this not serving my files??
app.use(serveStatic(__dirname + '/public', {maxAge: '1d'}))

app.get("/", (req,res)=>{
    res.sendFile(__dirname +'/public/index.htm')
})

app.get("/nuclearspike.swf", (req,res)=>{
    res.sendFile(__dirname +'/public/nuclearspike.swf')
})

//have it catch .jpg requests and display some other image.

app.get('/*', (req, res) => {
    console.log('nuclearspike: ', req.baseUrl)
    res.redirect("http://www.kivalens.org/#/search") //include outdated-link
})

module.exports = app