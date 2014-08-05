/// Gulpfile.ts
/// ===========
/// Gulp build environment that aims to compile AngularJS TypeScript files into
/// their JavaScript equivalents.
///
/// <reference path="./types/tsd.d.ts" />
var gulp: any = require('gulp');
var util: any = require('gulp-util');
var path: any = require('path');
var bump: any = require('gulp-bump');
var notify: any = require('gulp-notify');
var pluralize: any = require('pluralize');
var logSymbols: any = require('log-symbols');
var runSequence: any = require('run-sequence');
var sourceStream: any = require('vinyl-source-stream');
var nib: any = require('nib');
var axis: any = require('axis-css');
var stylus: any = require('gulp-stylus');
var rename: any = require('gulp-rename');
var plumber: any = require('gulp-plumber');
var inject: any = require('gulp-inject');
var transform: any = require('gulp-inject/src/transform');
var bowerFiles: any = require('main-bower-files');
var templateCache: any = require('gulp-angular-templatecache');
var protractor: any = require('gulp-protractor').protractor;
var webserver: any = require('gulp-webserver');
var watch: any = require('gulp-watch');
import Q = require('q');
import chalk = require('chalk');
import rimraf = require('rimraf');
import lodash = require('lodash');
import browserify = require('browserify');



/// Environment flags
/// -----------------
/// Environment flags change the destination folders of the files.
var release: boolean = false;


/// Target directories
/// ------------------
/// The target directories for where we want to place our files.
var BUILD_DIR: string = 'build';
var RELEASE_DIR: string = 'release';


/// Grouped tasks
/// -------------
/// These are all of the grouped tasks that utilize the specialized tasks.
gulp.task('build', (cb) => {
  runSequence('clean', ['bower', 'typescript', 'templates', 'stylus'], 'index', cb);
});

gulp.task('serve', (cb) => {
  runSequence('build', ['webserver', 'watch'], cb);
});

gulp.task('release', (cb) => {
  release = true;
  runSequence('build', cb);
});


/// Specialized tasks
/// -----------------
/// These are all of the specialized tasks that will be utilized through the
/// build, serve, test, and release tasks.
gulp.task('clean', rimraf.bind(null, release ? RELEASE_DIR : BUILD_DIR));

gulp.task('bump', () => {
  return gulp.src(['./bower.json', './package.json'])
    .pipe(bump({type: util.env.type}))
    .pipe(gulp.dest('./'));
});

gulp.task('bower', () => {
  return gulp.src(bowerFiles({main: '**/*'}), {base: './bower_components'})
    .pipe(gulp.dest(path.join(release ? RELEASE_DIR : BUILD_DIR, 'bower_components')));
});

gulp.task('typescript', () => {
  var bundle: BrowserifyObject = browserify({debug: !release, entries: ['./app/app.ts']});
  typescriptErrors = [];
  bundle.on('error', onTypescriptError);
  return bundle
    .plugin('tsify', {noImplicitAny: true, target: 'ES5'})
    .bundle()
    .pipe(sourceStream('app.ts'))
    .pipe(rename('app.js'))
    .pipe(gulp.dest(release ? RELEASE_DIR : BUILD_DIR));
});

gulp.task('templates', () => {
  return gulp.src(['!./app/index.html', './app/**/*.html'])
    .pipe(templateCache('app-templates.js', {
      standalone: true,
      module: require('./package').name + '.templates'
    }))
    .pipe(gulp.dest(release ? RELEASE_DIR : BUILD_DIR));
});

gulp.task('stylus', () => {
  return gulp.src('./app/app.styl')
    .pipe(plumber())
    .pipe(stylus({
      use: [axis(), nib()],
      import: process.cwd() + '/bower_components/material-colors/dist/colors.styl'
    }))
    .pipe(gulp.dest(release ? RELEASE_DIR : BUILD_DIR))
});

transform.html.css = (filepath) => '<link rel="stylesheet" href="' + filepath + '" shim-shadowdom>';
gulp.task('index', () => {
  return gulp.src('./app/index.html')
    .pipe(inject(gulp.src(['**/*.js', '**/*.css', '!bower_components/**/*'], {
      cwd: release ? RELEASE_DIR : BUILD_DIR,
      read: false
    })))
    .pipe(gulp.dest(release ? RELEASE_DIR : BUILD_DIR));
});

gulp.task('protractor', () => {
  return gulp.src('./app/**/*_test.js');
});

gulp.task('webserver', () => {
  return gulp.src(release ? RELEASE_DIR : BUILD_DIR)
    .pipe(webserver({livereload: true}));
});

gulp.task('watch', () => {
  watch({name: 'typescript', emitOnGlob: false, glob: './app/**/*.ts'}, () => {
    gulp.start('typescript');
  });

  watch({name: 'templates', emitOnGlob: false, glob: ['./app/**/*.html', '!./app/index.html']}, () => {
    gulp.start('templates');
  });

  watch({name: 'stylus', emitOnGlob: false, glob: './app/**/*.styl'}, () => {
    gulp.start('stylus');
  });

  watch({name: 'index', emitOnGlob: false, glob: './app/index.html'}, () => {
    gulp.start('index');
  });
});


/// Error reporter
/// --------------
/// Stylizes the error reports. Basically a clone of jshint-stylish.
var debouncedReporter: Function = lodash.debounce(reporter, 0);
function reporter (errors: Array<any>) {
  var groupedErrors: lodash.Dictionary<any> = lodash.groupBy(errors, 'fileName');
  lodash.forEach(groupedErrors, (errors: Array<any>, fileName: string) => {
    util.log();
    util.log(chalk.bold.underline(fileName));
    lodash.forEach(errors, (err: any) => {
      util.log(
        ' ',
        chalk.bold.gray('line ' + err.line),
        chalk.bold.gray('col ' + err.column),
        chalk.blue(err.message)
      );
    });
    util.log();
    util.log(
      chalk.red(logSymbols.error),
      chalk.bold.red(errors.length.toString()),
      chalk.bold.red(pluralize('problem', errors.length))
    );
    util.log();
  });
}


/// Error handlers
/// --------------
/// The error handlers for the specialized tasks.
var typescriptErrors: Array<any>;
function onTypescriptError (err: any) {
  if (!err.fileName) { return; }
  err.fileName = path.relative(process.cwd(), err.fileName);
  typescriptErrors.push(err);
  debouncedReporter(typescriptErrors);
}
