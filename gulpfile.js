'use strict';

const
    sourceMap     = {},
    gulp          = require('gulp'),
    handlebars    = require('gulp-compile-handlebars'),
    rename        = require('gulp-rename'),
    vinylMap      = require('vinyl-map'),
    replace       = require('gulp-replace');

gulp.task('createSourceMap', () => {

    let fileToString = vinylMap(file => {
        sourceMap['observer-script'] = file.toString();
    });

    gulp.src('lib/page-observer.js')
        .pipe(replace('\\', '\\\\'))
        .pipe(fileToString)
});

gulp.task('build', ['createSourceMap'], () => {
    gulp.src('templates/dynamic-loader.hbs')
        .pipe(handlebars(sourceMap))
        .pipe(rename('loader.js'))
        .pipe(gulp.dest('dist'));
});