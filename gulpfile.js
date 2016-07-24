'use strict';

const
    gulp       = require('gulp'),
    handlebars = require('gulp-compile-handlebars'),
    rename     = require('gulp-rename'),
    readFile   = require('./lib/util/read-file');

let sourceMap;

gulp.task('createSourceMap', () => {
    return readFile('./lib/page-observer.js')
        .then(source => {
            sourceMap = {
                'observer-script' : source
            };
        });
});

gulp.task('build', ['createSourceMap'], () => {
    gulp.src('templates/dynamic-loader.hbs')
        .pipe(handlebars(sourceMap))
        .pipe(rename('loader.js'))
        .pipe(gulp.dest('dist'));
});