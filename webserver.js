// webserver.js
// songyubin@chinaso.com
// 2017-06-19

var debuglevel = 1;
var webserver = require('webserver');
var server = webserver.create();
var system = require('system');
if (system.args.length !== 2) {
  console.log('Usage: webserver.js <PORT>');
  phantom.exit(1);
}
var port = system.args[1];

var listening = server.listen(port, function(request, response) {

    var timestamp = (new Date()).valueOf();;
    var timerid;
    var page = require('webpage').create();
    page.settings.loadImages = false;
    page.settings.userAgent = 'User-Agent: Mozilla/5.0 (Windows NT 6.1; rv:39.0) Gecko/20100101 Firefox/39.0';
    var result = 200;

    page.onResourceRequested = function (req, networkRequest) {
        if (req.url == address && req.stage == "end" && res.status !== null) {
            result = req.status;
        }

        if ((/https?:\/\/.*\.css.*/gi).test(req.url)) {
            if (debuglevel >= 1)
                system.stderr.writeLine('Filter css request:' + req.url);
            networkRequest.abort();
            req.abort();
        }
        if (debuglevel >= 3)
            system.stderr.writeLine('requested: ' + JSON.stringify(req, undefined, 4));
    };

    page.onResourceReceived = function (res) {
        timestamp = (new Date()).valueOf();
        page.evaluate(function() {window._phantom=false; window.__phantomas=false;});

        if (debuglevel >= 3)
          system.stderr.writeLine('received: ' + JSON.stringify(res, undefined, 4));
        if (debuglevel >= 2)
          system.stderr.writeLine('received: ' + timestamp);
    };

    page.onLoadFinished = function() {
        if (debuglevel >= 2)
          system.stderr.writeLine("page.onLoadFinished");
    };

    console.log("request:" + request.url.substring(6));
    if (request.url.indexOf("/?url=http") < 0) {
        response.statusCode = 404;
        response.write("<html><body></body></html>");
        response.close();
    }
    else {
        var checktime = 1;
        var address = request.url.substring(6);
        system.stderr.writeLine('request address:' + address);

        page.open(address, function (status) {
            if (status !== 'success') {
              system.stderr.writeLine('open fail');
            }
            else {
              system.stderr.writeLine('open success');
            }
        });

        function checkFinished() {
            var now = (new Date()).valueOf();
            var diff = now - timestamp;
            if (debuglevel >= 2)
                system.stderr.writeLine("checkFinished " + diff);

            if (diff > 2*1000) {
                if (debuglevel >= 2)
                    system.stderr.writeLine("resource timeout");
                if (checktime < 3) {
                    if (debuglevel >= 2)
                        system.stderr.writeLine("scroll to end of page");
                    page.evaluate(function() {window.scrollTo(0, document.body.scrollHeight);});
                    checktime += 1;
                    timestamp = (new Date()).valueOf();
                    return;
                }

                system.stderr.writeLine('result:'+ result);

                if (result == 200) {
                    response.statusCode = 200;
                    response.write(page.content);
                    response.close();
                } else {
                    response.statusCode = 404;
                    response.write("<html><body></body></html>");
                    response.close();
                }
                clearInterval(timerid);
                page.close();
            }
        }
        timerid = setInterval(checkFinished, 1*1000);

  }

});
