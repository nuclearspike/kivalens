//KIVALENS REACT
var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    rename = require('gulp-rename')
var autoprefixer = require('gulp-autoprefixer')
var uglify = require('gulp-uglify')
var cleanCSS = require('gulp-clean-css')
var sass = require('gulp-sass')(require('sass'))
var browserify = require('browserify')
var watchify = require('watchify')
var babelify = require('babelify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var gulpif = require('gulp-if'),
    concat = require("gulp-concat")

var production = false; //todo: find what node production environment settings do.

gulp.task('styles', function(){
  console.log('[Gulp] Styles changed')
  return gulp.src(['src/styles/**/*.scss'])
    .pipe(plumber({
      errorHandler: function (error) {
        console.log(error.message)
        this.emit('end')
    }}))
    .pipe(sass().on('error', sass.logError))
    .pipe(gulpif(production, autoprefixer('last 5 versions')))
    .pipe(gulp.dest('../public/stylesheets/'))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulpif(production, cleanCSS()))
    .pipe(gulp.dest('../public/stylesheets/'))
})

function compile(watch) {
    var bundler = browserify('./src/scripts/app.js', { debug: true, transform: [babelify.configure({plugins: ["jsx-control-statements/babel"]})] })

    if (watch)
        bundler = watchify(bundler)

    function rebundle() {
      return bundler.bundle()
        .on('error', function (err) {
          console.error('[Gulp] Build error:', err)
          this.emit('end')
        })
        .pipe(source('build.js'))
        .pipe(buffer())
        .pipe(gulpif(production, uglify({output: {ascii_only: true}})))
        .pipe(gulp.dest('../public/javascript'))
    }

    if (watch) {
        console.log('watching for changes...')
        bundler.on('update', function() {
            console.log('-> change:bundling...')
            rebundle()
            console.log('-> done.')
            console.log('waiting...')
        })
    }

    return rebundle()
}

function vendorScripts() {
    return gulp.src('./src/scripts/vendor/*.min.js')
        .pipe(concat('vendor.js'))
        .pipe(gulp.dest('../public/javascript'))
}

gulp.task("production", function(done){
    console.log("SWITCHING TO PRODUCTION MODE")
    production = true
    process.env.NODE_ENV = 'production'
    done()
})

gulp.task('scripts', gulp.parallel(
    function bundleScripts(done) { compile(false).on('end', done) },
    vendorScripts
))

gulp.task('watch', function(done) { compile(true); done() })

gulp.task('prod', gulp.series('production', gulp.parallel('styles', 'scripts')))

gulp.task('default', gulp.series(gulp.parallel('styles', 'scripts'), function watching(done){
  console.log('[Gulp] Watching for changes')
  gulp.watch("src/styles/**/*.scss", gulp.series('styles'))
  gulp.watch("src/scripts/**/*.jsx", gulp.series('scripts'))
  gulp.watch("src/scripts/**/*.js", gulp.series('scripts'))
  done()
}))
