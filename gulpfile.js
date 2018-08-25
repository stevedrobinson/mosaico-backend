'use strict'

const gulp = require('gulp')
const path = require('path')
const $ = require('gulp-load-plugins')()
const browserSync = require('browser-sync').create()
const { reload } = browserSync
const lazypipe = require('lazypipe')
const del = require('del')
const merge = require('merge-stream')
const args = require('yargs').argv
const _ = require('lodash')
const { cyan, magenta } = require('chalk')
const Vinyl = require(`vinyl`)

const isDev = args.dev === true
const isBuild = !isDev
const env = isDev ? 'development' : 'build'

const buildDir = 'dist'

function onError(err) {
  if (err.annotated) {
    console.log(err.annotated)
  } else if (err.message) {
    console.log(err.message)
  } else {
    console.log(err)
  }
  return this.emit('end')
}

console.log('environment is', magenta(env))

function bump() {
  return gulp
    .src(`package.json`)
    .pipe(
      $.bump({
        version: args.pkg,
      })
    )
    .pipe(gulp.dest('./'))
}
bump.description = `Bump versions on package.json. Used only in release script`

const unDevName = lazypipe().pipe(
  $.rename,
  filePath => (filePath.basename = filePath.basename.replace('-dev', ''))
)

////////
// CSS
////////

const autoprefixer = require('autoprefixer')
const csswring = require('csswring')

const cssProd = lazypipe()
  .pipe(unDevName)
  .pipe($.purgeSourcemaps)
  .pipe(
    $.postcss,
    [csswring({ removeAllComments: true })]
  )

function cleanCss() {
  return del([buildDir + '/*.css', buildDir + '/*.css.map'])
}

function cssEditor() {
  return gulp
    .src('src/css/custom-editor.less')
    .pipe($.plumber(onError))
    .pipe($.sourcemaps.init())
    .pipe($.less())
    .pipe($.postcss([autoprefixer({ browsers: ['ie 10', 'last 2 versions'] })]))
    .pipe($.sourcemaps.write())
    .pipe($.rename('editor-dev.css'))
    .pipe(gulp.dest(buildDir))
    .pipe(reload({ stream: true }))
    .pipe($.if(isBuild, cssProd()))
    .pipe($.if(isBuild, gulp.dest(buildDir)))
}
cssEditor.description = `build CSS for mosaico editor`
exports[`css:mosaico`] = cssEditor

function cssApp() {
  return gulp
    .src('src/css-backend/index.styl')
    .pipe($.plumber(onError))
    .pipe($.sourcemaps.init())
    .pipe(
      $.stylus({
        'include css': true,
      })
    )
    .pipe($.postcss([autoprefixer({ browsers: ['ie 10', 'last 2 versions'] })]))
    .pipe(
      $.replace(
        'rgb(255,152,0)',
        'var(--color-primary, var(--default-color-primary))'
      )
    )
    .pipe(
      $.replace(
        'rgb(68,138,255)',
        'var(--color-accent, var(--default-color-accent))'
      )
    )
    .pipe($.sourcemaps.write())
    .pipe($.rename('app-dev.css'))
    .pipe(gulp.dest(buildDir))
    .pipe(reload({ stream: true }))
    .pipe($.if(isBuild, cssProd()))
    .pipe($.if(isBuild, gulp.dest(buildDir)))
}
cssApp.description = `build CSS for the backend`
exports[`css:backend`] = cssApp

const css = gulp.series(cleanCss, gulp.parallel(cssEditor, cssApp))
css.description = `Build CSS for the mosaico editor and the app`

////////
// JS
////////

//----- LIBRARIES

function cleanLib() {
  return del(buildDir, '/**/*.js')
}

function mosaicoLib() {
  return gulp
    .src([
      `node_modules/jquery/dist/jquery.js`,
      // NOTE: use minimized version because non-min uses console to write migration warnings
      `node_modules/jquery-migrate/dist/jquery-migrate.min.js`,
      `node_modules/knockout/build/output/knockout-latest.js`,
      `node_modules/jquery-ui-package/jquery-ui.js`,
      `node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch.js`,
      `node_modules/default-passive-events/dist/index.js`,
      // NOTE: include these 2 BEFORE the fileupload libs
      // using npm5 we can get sub-dependencies from nested paths, but npm3 does flatten them, so let's depend on them explicitly.
      // 'node_modules/blueimp-file-upload/node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.js',
      // 'node_modules/blueimp-file-upload/node_modules/blueimp-load-image/js/load-image.all.min.js',
      `node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.js`,
      `node_modules/blueimp-load-image/js/load-image.all.min.js`,
      // 'node_modules/blueimp-file-upload/js/jquery.iframe-transport.js',
      `node_modules/blueimp-file-upload/js/jquery.fileupload.js`,
      `node_modules/blueimp-file-upload/js/jquery.fileupload-process.js`,
      `node_modules/blueimp-file-upload/js/jquery.fileupload-image.js`,
      `node_modules/blueimp-file-upload/js/jquery.fileupload-validate.js`,
      `node_modules/knockout-jqueryui/dist/knockout-jqueryui.js`,
      `node_modules/tinymce/tinymce.js`,
      `node_modules/tinymce/themes/modern/theme.js`,
      `node_modules/tinymce/plugins/link/plugin.js`,
      `node_modules/tinymce/plugins/hr/plugin.js`,
      `node_modules/tinymce/plugins/paste/plugin.js`,
      `node_modules/tinymce/plugins/lists/plugin.js`,
      `node_modules/tinymce/plugins/textcolor/plugin.js`,
      `node_modules/tinymce/plugins/code/plugin.js`,
    ])
    .pipe($.concat('lib-editor-dev.js'))
    .pipe(gulp.dest(buildDir + '/lib'))
    .pipe($.if(isBuild, unDevName()))
    .pipe($.if(isBuild, $.uglify()))
    .pipe(gulp.dest(buildDir + '/lib'))
}
mosaicoLib.description = `copy all related tinymce files to the right place`
exports[`js:mosaico-lib`] = mosaicoLib

function copyTinymceFiles() {
  return gulp
    .src(
      [
        'node_modules/tinymce/themes/modern/theme.js',
        'node_modules/tinymce/themes/modern/theme.min.js',
        'node_modules/tinymce/plugins/paste/plugin.js',
        'node_modules/tinymce/plugins/paste/plugin.min.js',
        'node_modules/tinymce/plugins/link/plugin.js',
        'node_modules/tinymce/plugins/link/plugin.min.js',
        'node_modules/tinymce/plugins/hr/plugin.js',
        'node_modules/tinymce/plugins/hr/plugin.min.js',
        'node_modules/tinymce/plugins/lists/plugin.js',
        'node_modules/tinymce/plugins/lists/plugin.min.js',
        'node_modules/tinymce/plugins/textcolor/plugin.js',
        'node_modules/tinymce/plugins/textcolor/plugin.min.js',
        'node_modules/tinymce/plugins/colorpicker/plugin.js',
        'node_modules/tinymce/plugins/colorpicker/plugin.min.js',
        'node_modules/tinymce/plugins/code/plugin.js',
        'node_modules/tinymce/plugins/code/plugin.min.js',
      ],
      { base: 'node_modules/tinymce' }
    )
    .pipe(gulp.dest(buildDir + '/lib'))
}
copyTinymceFiles.description = `copy all related tinymce files to the right place`
exports[`js:tinymce`] = copyTinymceFiles

// Bundling mosaico libs is just a concat…
const editorLib = gulp.series(cleanLib, mosaicoLib)
editorLib.description = `build JS for the mosaico editor and the app`

//----- MOSAICO APPLICATION

const browserify = require('browserify')
const source = require('vinyl-source-stream')
const vinylBuffer = require('vinyl-buffer')
const aliasify = require('aliasify')
const shim = require('browserify-shim')
const babelify = require('babelify')
const envify = require('envify/custom')
const watchify = require('watchify')

function mosaicoEditor(debug = false) {
  return browserify({
    cache: {},
    packageCache: {},
    debug: debug,
    entries: [`./src/js/app.js`, `./build/templates.js`],
    standalone: `Mosaico`,
  })
    .transform(aliasify)
    .transform(shim, { global: true })
    .transform(
      // babelify only apply to our own custum additions
      babelify.configure({
        presets: [`env`],
        only: /custom-/,
      })
    )
    .transform(
      envify({
        _: 'purge',
        NODE_ENV: debug,
        CUSTOM: true,
        MOSAICO: false,
      })
    )
}

function jsMosaicoDev() {
  let b = mosaicoEditor(true)
  if (isDev) {
    b = watchify(b)
    b.on('update', function() {
      console.log(`bundle ${magenta('editor')} app`)
      bundleShareDev(b)
    })
  }
  return bundleShareDev(b)
}

function bundleShareDev(b) {
  return b
    .bundle()
    .on('error', onError)
    .pipe(source('editor-dev.js'))
    .pipe(vinylBuffer())
    .pipe(gulp.dest(buildDir))
}

function jsMosaicoProd() {
  return mosaicoEditor()
    .bundle()
    .on('error', onError)
    .pipe(source('editor.js'))
    .pipe(vinylBuffer())
    .pipe($.stripDebug())
    .pipe($.uglify())
    .pipe(gulp.dest(buildDir))
}

const jsEditor = gulp.series(
  templates,
  isBuild ? gulp.parallel(jsMosaicoDev, jsMosaicoProd) : jsMosaicoDev
)
jsEditor.description = `Bundle mosaico app, without libraries`

exports[`js:mosaico-editor`] = jsEditor
exports[`js:mosaico`] = gulp.parallel(editorLib, jsEditor)

//----- MOSAICO'S KNOCKOUT TEMPLATES: see -> combineKOTemplates.js

const through = require('through2')
const StringDecoder = require('string_decoder').StringDecoder
const decoder = new StringDecoder('utf8')

function templates() {
  const templates = []
  function passThrough(file, encoding, cb) {
    var name = path.basename(file.path)
    var name = /^([^\.]*)/.exec(name)[1]
    var content = decoder.write(file.contents)
    content = content.replace(/"/g, '\\x22')
    content = content.replace(/(\r\n|\n|\r)/gm, '')
    content = `  templateSystem.addTemplate("${name}", "${content}");`
    // content     = "  templateSystem.addTemplate(\"" + name + "\", \"" + content + "\");";
    templates.push(content)
    return cb(null)
  }
  function flush(cb) {
    var result =
      "var templateSystem = require('../src/js/bindings/choose-template.js');\n"
    result =
      result +
      "document.addEventListener('DOMContentLoaded', function(event) {\n"
    result = result + templates.join('\n') + '\n'
    result = result + '});\n'
    this.push(
      new Vinyl({
        cwd: './',
        base: './',
        path: 'templates.js',
        contents: new Buffer(result),
      })
    )
    return cb()
  }
  return (
    gulp
      .src([
        'src/tmpl/*.html',
        // replace some original templates by custom ones
        'src/tmpl-custom/*.html',
        '!src/tmpl/gallery-images.tmpl.html',
      ])
      .pipe(through.obj(passThrough, flush))
      // templates has to be build on “build” folder
      // they will be require by editor app application
      .pipe(gulp.dest('build'))
  )
}

//----- HOME JS (rename for now)

const pugify = require('pugify')

function jsUser(debug = false) {
  return browserify({
    cache: {},
    packageCache: {},
    debug: debug,
    entries: ['./src/js-user-backend/index.js'],
  })
    .transform(babelify, {
      presets: ['env'],
    })
    .transform(
      pugify.pug({
        pretty: debug,
        compileDebug: debug,
      })
    )
    .transform(
      envify({
        _: 'purge',
        NODE_ENV: debug ? 'development' : 'production',
        LOG: debug,
      })
    )
}

function jsUserDev() {
  let b = jsUser(true)
  if (isDev) {
    b = watchify(b)
    b.on('update', function() {
      console.log(`bundle ${magenta('user')} app`)
      bundleUserDev(b)
    })
  }
  return bundleUserDev(b)
}

function bundleUserDev(b) {
  return b
    .bundle()
    .on('error', onError)
    .pipe(source('user-dev.js'))
    .pipe(vinylBuffer())
    .pipe(gulp.dest(buildDir))
}

function jsUserProd() {
  return jsUser()
    .bundle()
    .on('error', onError)
    .pipe(source('user.js'))
    .pipe(vinylBuffer())
    .pipe($.uglify())
    .pipe(gulp.dest(buildDir))
}

gulp.task('js:user', isBuild ? gulp.parallel(jsUserDev, jsUserProd) : jsUserDev)

//----- ADMIN JS

function jsAdmin(debug = false) {
  return browserify({
    cache: {},
    packageCache: {},
    debug: debug,
    entries: ['./src/js-admin-backend/index.js'],
  })
    .transform(babelify, {
      presets: ['env'],
    })
    .transform(
      envify({
        _: 'purge',
        NODE_ENV: debug ? 'development' : 'production',
        LOG: debug,
      })
    )
}

function jsAdminDev() {
  let b = jsAdmin(true)
  if (isDev) {
    b = watchify(b)
    b.on('update', function() {
      console.log(`bundle ${magenta('admin')} app`)
      bundleAdminDev(b)
    })
  }
  return bundleAdminDev(b)
}

function bundleAdminDev(b) {
  return b
    .bundle()
    .on('error', onError)
    .pipe(source('admin-dev.js'))
    .pipe(vinylBuffer())
    .pipe(gulp.dest(buildDir))
}

function jsAdminProd() {
  return jsAdmin()
    .bundle()
    .on('error', onError)
    .pipe(source('admin.js'))
    .pipe(vinylBuffer())
    .pipe($.uglify())
    .pipe(gulp.dest(buildDir))
}

gulp.task(
  'js:admin',
  isBuild ? gulp.parallel(jsAdminDev, jsAdminProd) : jsAdminDev
)

const js = gulp.parallel(mosaicoLib, jsEditor, 'js:user', 'js:admin')
js.description = `build js for mosaico app and the for the rests of the application`

////////
// ASSETS
////////

//----- FONTS

function cleanFonts() {
  return del('res/fa/fonts')
}

function fonts() {
  return gulp
    .src('node_modules/@fortawesome/fontawesome-free/webfonts/*')
    .pipe(gulp.dest('res/fa/fonts'))
}

const assets = gulp.series(cleanFonts, fonts)
assets.description = `Copy font-awesome in the right place`

//----- MAINTENANCE

const maintenanceFolder = 'server/views/maintenance-pages'

const cleanMaintenance = cb => del([`${maintenanceFolder}/*.html`], cb)

function maintenance() {
  return gulp
    .src([`${maintenanceFolder}/*.pug`, `!${maintenanceFolder}/_*.pug`])
    .pipe($.pug())
    .pipe(gulp.dest(maintenanceFolder))
}

//----- REVS

const crypto = require('crypto')

function rev() {
  let revs = []
  function sortByName(a, b) {
    const nameA = a.name.toUpperCase()
    const nameB = b.name.toUpperCase()
    if (nameA < nameB) return -1
    if (nameA > nameB) return 1
    return 0
  }
  function passThrough(file, enc, callback) {
    const key = path.relative(file.base, file.path)
    const md5 = crypto.createHash('md5')
    if (!file.contents) return callback(null)
    const hash = md5.update(file.contents.toString()).digest('hex')
    revs.push({ name: '/' + key, hash })
    callback(null)
  }
  function flush(cb) {
    const md5Object = {}
    // keep the json in alphabetical order
    revs.sort(sortByName).forEach(r => {
      md5Object[r.name] = r.hash
    })
    let file = new Vinyl({
      path: 'md5public.json',
      contents: new Buffer(JSON.stringify(md5Object, null, ' ')),
    })
    this.push(file)
    cb()
  }

  return gulp
    .src([
      'dist/**/*.*',
      '!dist/**/*-dev.*',
      'res/**/*.*',
      '!res/lang/*.*',
      'node_modules/material-design-lite/*.js',
      'node_modules/material-design-icons-iconfont/dist/**/*.*',
      '!node_modules/material-design-icons-iconfont/dist/**/*.scss',
    ])
    .pipe(through.obj(passThrough, flush))
    .pipe(gulp.dest('server'))
}

////////
// DEV
////////

const cleanTmp = cb => del(['tmp/upload_*'], cb)

function toc() {
  return gulp
    .src('./BACKEND.md')
    .pipe(
      $.doctoc({
        mode: 'github.com',
      })
    )
    .pipe(gulp.dest('./'))
}
toc.description = `Regenerate TOC for BACKEND.md`

const cleanAll = cb => del([buildDir, 'build'], cb)
const build = gulp.series(
  cleanAll,
  gulp.parallel(editorLib, js, css, assets),
  rev
)
build.description = `rebuild all assets`

const nodemonOptions = {
  script: 'server/workers.js',
  ext: 'js json',
  watch: [
    'server/**/*.js',
    // '!server/locales/*.js',
    '.backendrc',
    'index.js',
    'res/lang/*.js',
    'shared/*.js',
  ],
}

let init = true
function nodemon(cb) {
  return $.nodemon(
    _.merge(
      {
        env: {
          NODE_ENV: 'development',
          VIPS_WARNING: false,
          // 'DEBUG':        'nightmare*',
        },
        // nodeArgs: ['--inspect'],
      },
      nodemonOptions
    )
  ).on('start', () => {
    // https://gist.github.com/sogko/b53d33d4f3b40d3b4b2e#comment-1457582
    if (init) {
      init = false
      cb()
    }
  })
}

function launchBrowserSync(cb) {
  browserSync.init(
    {
      proxy: 'http://localhost:3000',
      open: false,
      port: 7000,
      ghostMode: false,
    },
    cb
  )
}

const bsAndWatch = gulp.series(launchBrowserSync, watchFiles)

let initProd = true
function nodemonProd(cb) {
  return $.nodemon(
    _.merge({ env: { NODE_ENV: 'production' } }, nodemonOptions)
  ).on('start', () => {
    if (initProd) {
      initProd = false
      cb()
    }
  })
}

function watchFiles(cb) {
  gulp.watch(['server/views/*.jade', 'dist/*.js']).on('change', reload)
  gulp.watch('src/css/**/*.less', cssEditor)
  gulp.watch('src/css-backend/**/*.styl', cssApp)
  gulp.watch(['src/tmpl/*.html', 'src/tmpl-custom/*.html'], templates)
  cb()
}

gulp.task('css', css)
gulp.task('css:editor', cssEditor)
gulp.task('css:app', cssApp)
gulp.task('js', js)
gulp.task('js:editor', jsEditor)
gulp.task('js:editor-libs', mosaicoLib)
gulp.task('assets', assets)
gulp.task('rev', rev)
gulp.task('templates', templates)
gulp.task('build', build)
gulp.task('maintenance', gulp.series(cleanMaintenance, maintenance))
gulp.task('dev', gulp.series(build, nodemon, bsAndWatch))
gulp.task('prod', gulp.parallel(js, nodemonProd), watchFiles)
gulp.task('bump', bump)
gulp.task('toc', toc)
