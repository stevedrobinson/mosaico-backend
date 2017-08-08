'use srict'

const path                    = require( 'path' )
const chalk                   = require( 'chalk' )
const fs                      = require( 'fs-extra' )
const crypto                  = require( 'crypto' )
const createError             = require( 'http-errors' )

const defer                   = require( '../helpers/create-promise' )
const getTemplateImagePrefix  = require( '../helpers/get-template-image-prefix' )
const slugFilename            = require( '../../shared/slug-filename' )
const filemanager             = require( '../filemanager' )

const tmplsRootPath = path.join( __dirname, '../../templates' )
const tmplsPath     = {
  'tedc15': {
    html:   path.join( tmplsRootPath, '/tedc15/template-tedc15.html' ),
  },
  'versafix-1': {
    html:   path.join( tmplsRootPath, '/versafix-1/template-versafix-1.html' ),
    files:  path.join( tmplsRootPath, '/versafix-1/img' ),
  }
}

function getAllFiles( basePath ) {
  const fileList  = []

  function walk( dir ) {
    const dfd       = defer()

    fs
    .readdir( dir )
    .then( files => {
      files = files.filter( file => !/\.DS_Store/.test(file) )
      .map( file => {
        return {
          name: file,
          path: path.join(dir, file),
        }
      })
      const stats = files.map( file => fs.stat(file.path) )
      return Promise.all( [files, Promise.all(stats)] )
    })
    .then( ([files, stats]) => {
      const folders     = []
      stats.forEach( (stat, i) => {
        if ( stat.isFile() ) return fileList.push( files[i] )
        if ( stat.isDirectory() ) folders.push( walk( files[i].path ) )
      })
      return Promise.all( folders )
    })
    .then( folders => dfd.resolve( fileList ) )
    .catch( dfd.reject )

    return dfd
  }

  return walk( basePath )
}

async function autoUpload( req, res, next ) {
  const { Template }  = req.app.get( 'models' )
  const {
    templateId,
    templateName }    = req.params
  const redirectUrl   = `/templates/${templateId}`
  if (!templateName in tmplsPath) return res.redirect( redirectUrl )

  const tmplPath      = tmplsPath[templateName]
  const hasFiles      = tmplPath.files != null
  const requests      = [
    Template.findById( templateId ),
    fs.readFile( tmplPath.html, 'utf8' ),
    hasFiles ? getAllFiles( tmplPath.files ) : Promise.resolve( [] ),
  ]
  const [template, markup, files] = await Promise.all( requests )
  if ( !template ) return next( createError(404) )

  template.markup   = markup
  const fileBuffers = await Promise.all( files.map( file => fs.readFile(file.path)) )
  const uploads     = []
  const assets      = {}
  files.forEach( (file, i) => {
    const ext           = path.extname( file.name )
    const fileName      = slugFilename( file.name )
    const hash          = crypto.createHash('md5').update( fileBuffers[i] ).digest('hex')
    const name          = `${ getTemplateImagePrefix(templateId) }-${ hash }.${ ext }`
    file.name           = name
    file.originalName   = fileName
    // this will be used to update `assets` field in DB
    assets[ fileName ]  = name
    uploads.push( filemanager.writeStreamFromPath(file) )
  })
  const uploadsDone     = await Promise.all( uploads )
  template.assets       = Object.assign( {}, template.assets || {},  assets )
  const updatedTemplate = await template.save()
  res.redirect( redirectUrl )
}

module.exports = {
  autoUpload,
}
