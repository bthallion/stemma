'use strict';

const
    readFile   = require('./util/read-file'),
    Promise    = require('bluebird'),
    handlebars = require('handlebars');

function build() {
    const
        loaderPath = 'templates/markup-loader.hbs',
        scriptPath = 'lib/page-observer.js';

    return Promise.all([
        readFile(loaderPath),
        readFile(scriptPath)
    ]).then(sources => {
        let loaderSource   = sources[0],
            scriptSource   = sources[1];

        let loaderTemplate = handlebars.compile(loaderSource),
            sourceMap      = {
                'observer-script' : scriptSource
            };

        return loaderTemplate(sourceMap);
    });
}

module.exports = build;