var http = require('http');
var fs = require('fs');

var file = fs.createWriteStream("atheist_data.csv");
var request = http.get("http://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export?gid=1&format=csv", function(response) {
    response.pipe(file);
});