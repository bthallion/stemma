'use strict';

const
    fs         = require('fs'),
    path       = require('path'),
    Promise    = require('bluebird'),
    handlebars = require('handlebars');

function readFile(filePath) {
    return new Promise(resolve => {
        fs.readFile(
            path.resolve(__dirname, '..', filePath),
                {
                    encoding : 'utf8'
                },
            function (err, data) {
                if (err) {
                    throw err;
                }
                resolve(data);
            }
        );
    });
}

function build() {
    const
        loaderPath = 'template/loader.html',
        scriptPath = 'lib/page-observer.js';

    return Promise.all([
        readFile(loaderPath),
        readFile(scriptPath)
    ]).then(sources => {
        let loaderSource   = sources[0],
            scriptSource   = sources[1],
            loaderTemplate = handlebars.compile(loaderSource),
            insertionMap   = {
                'observer-script' : scriptSource
            };

        return loaderTemplate(insertionMap);
    });
}

module.exports = build;