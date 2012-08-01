var config = require('config').imageFetcher;
var fs = require('fs');
var path = require('path');
var downloadImage = require('./downloadQueue');

var Conversion = require('./imageConverter').Conversion;

var isFileStale = function(stat){
    var creationTimestamp = stat.ctime.getTime();
    var age = (Date.now() - creationTimestamp) / (1000);

    return age > config.cache.cacheTime;
};


module.exports = function(options){
    
    return function(req, res, next) {
        rcv = snd = 0;
        var i, whitelist, urlAllowed = false;

        if (!req.query.url) {
            res.statusCode = 400;
            res.write('Image URL parameter is missing', 'utf8');
            res.end();
            return;
        }

        req.query.mime = req.query.mime || config.defaultOutputMime;

        var targetCachePath = config.cache.basePath + req.fingerprint;
        var sourceCachePath = config.cache.basePath + req.sourceFingerprint;

        var deliver = function() {
            fs.createReadStream(targetCachePath).pipe(res);
        };

        fs.stat(targetCachePath, function(err, stat) {
            if (stat && !isFileStale(stat)) {
                //just deliver the file without doing anything.
                deliver();
            } else {
                var conversion = new Conversion(function(conversion){
                    var convert = function() {
                        conversion.initialize(
                            req.query.mime,
                            sourceCachePath,
                            targetCachePath
                            );
                        res.setHeader('Content-Type', req.query.mime);
                        conversion.width(req.query.width).height(req.query.height);
                        conversion.quality(req.query.quality);
                        var process = conversion.startProcess();
                        process.on('exit', deliver);
                    };

                    fs.stat(sourceCachePath, function(err, stat) {
                        if(stat && !isFileStale(stat)) {
                            convert();
                        } else {
                            downloadImage(
                                req.query.url,
                                sourceCachePath,
                                convert,
                                function(code, message){
                                    res.statusCode = code;
                                    res.end(message);
                                    return;
                                }
                            );
                        }
                    });

                });
            }
        });
    };
};
