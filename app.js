var express = require('express');
var app = express();
app.use(express.static('public'));
app.set('view engine','hbs');
var hbs = require('hbs');
hbs.registerPartials(__dirname + '/views/partials');
app.get('/', function (req, res) {
    res.render('test-frame-resets');
});


console.log('starting server...');
var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});