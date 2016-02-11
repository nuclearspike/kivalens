//KIVALENS REACT
var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    rename = require('gulp-rename')
var autoprefixer = require('gulp-autoprefixer')
var uglify = require('gulp-uglify')
var minifycss = require('gulp-minify-css')
var sass = require('gulp-sass')
var browserSync = require('browser-sync')
var browserify = require('browserify')
var watchify = require('watchify')
var notifier = require('node-notifier')
var babelify = require('babelify')
var sourcemaps = require('gulp-sourcemaps')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var gutil = require( 'gulp-util' )
var ftp = require( 'vinyl-ftp' )
var argv = require('yargs').argv,
    gulpif = require('gulp-if')

var production = false; //todo: find what node production environment settings do.


gulp.task('browser-sync', function() {
  browserSync({server: {baseDir: "./"}})
})

gulp.task('bs-reload', function () {
  browserSync.reload()
})

gulp.task('styles', function(){
  notifier.notify({title: 'Gulp', message: 'Styles changed'})
  gulp.src(['src/styles/**/*.scss'])
    .pipe(plumber({
      errorHandler: function (error) {
        console.log(error.message)
        this.emit('end')
    }}))
    .pipe(sass())
    //.pipe(postcss([autoprefixer]).process())
    .pipe(gulpif(production, autoprefixer('last 5 versions')))
    .pipe(gulp.dest('../public/stylesheets/'))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulpif(production, minifycss())) //skip minification, it still goes into the .min unminified if non-prod
    .pipe(gulp.dest('../public/stylesheets/'))
    .pipe(browserSync.reload({stream:true}))
})

function compile(watch) {
    var bundler = browserify('./src/scripts/app.js', { debug: true, transform: [babelify.configure({plugins: ["jsx-control-statements/babel"]})] })

    if (watch)
        bundler = watchify(bundler)

    function rebundle() {
        bundler.bundle()
            .on('error', function(err) {
                notifier.notify({title: 'Gulp', message: 'An error occurred during building. Check the console for details. ' + err})
                console.error(err)
                this.emit('end')
            })
            .pipe(source('build.js'))
            .pipe(buffer())
            .pipe(gulpif(production, uglify({output: {ascii_only:true}})))
            .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest('../public/javascript'))
            .pipe(browserSync.reload({stream:true}))
    }

    if (watch) {
        console.log('watching for changes...')
        bundler.on('update', function() {
            notifier.notify({title: 'Gulp', message: "Change Detected"})
            console.log('-> change:bundling...')
            rebundle()
            notifier.notify({title: 'Gulp', message: "Done"})
            console.log('-> done.')
            console.log('waiting...')
        })
    }
    rebundle()
}

gulp.task("production", function(){
    console.log("SWITCHING TO PRODUCTION MODE")
    production = true
    return process.env.NODE_ENV = 'production' //
})

//SERVER
gulp.task('s', function() {
    var webserver = require('gulp-webserver')
    gulp.src('./')
        .pipe(webserver({
            fallback: 'index.html',
            livereload: true,
            open: true,
            enable: true
        }))
})

gulp.task("delete_rogue_react", function(){ //todo: temp fix!
    var clean = require('gulp-clean')
    return gulp.src('node_modules/react-infinite-list/node_modules/react', {read: false}).pipe(clean({force: true}))
})

gulp.task('scripts', function() { return compile(false) })
gulp.task('watch', function() { return compile(true) })

//deploy~: gulp d --u 'gjgjgjg' --pw djfjffj
gulp.task('prod', ['production','styles','scripts'])

gulp.task('default', ['styles','scripts'], function(){ //, 'browser-sync'
  notifier.notify({title: 'Gulp', message: 'Watching for changes'})
  gulp.watch("src/styles/**/*.scss", ['styles'])
  gulp.watch("src/scripts/**/*.jsx", ['scripts'])
  gulp.watch("src/scripts/**/*.js", ['scripts'])
  //gulp.watch("*.html", ['bs-reload'])
})