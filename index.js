var express = require('express');
var app = express();
var proxy = require('express-http-proxy');

app.use('/proxy/kiva', proxy('www.kiva.org', {
  forwardPath: function(req, res) {
    return require('url').parse(req.url).path;
  }
}));

app.use('/proxy/gdocs', proxy('https://docs.google.com', {
    forwardPath: function(req, res) {
        return require('url').parse(req.url).path;
    },
    intercept: function(rsp, data, req, res, callback){
        //console.log(JSON.stringify(data))
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');

        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
            res.send(200);
        } else {
            callback(null,data);
        }
    }
}));

app.set('port', (process.env.PORT || 3000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

//any page not defined in this file gets routed to everything which redirects to /#/search
app.get('/*', function(request, response) {
    response.render('pages/everything'); //can i do permanent redirect?
});

app.listen(app.get('port'), function() {
  console.log('KivaLens app is running on port', app.get('port'));
});


