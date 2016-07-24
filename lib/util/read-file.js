'use strict';

const
    fs         = require('fs'),
    path       = require('path'),
    Promise    = require('bluebird');

function readFile(filePath) {
    return new Promise(resolve => {
        fs.readFile(
            path.resolve(__dirname, '../..', filePath),
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

module.exports = readFile;