var express = require('express')
var app = express()
var serveStatic = require('serve-static')
app.use(serveStatic('./public'))

module.exports = app;