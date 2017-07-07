'use strict'

const Nightmare               = require( 'nightmare' )
const createError             = require( 'http-errors' )
const crypto                  = require( 'crypto' )
const path                    = require( 'path' )
const sharp                   = require( 'sharp' )
const fs                      = require( 'fs-extra' )

const config                  = require( '../config' )
const { Templates}            = require( '../models' )
const filemanager             = require( '../filemanager' )
const getTemplateImagePrefix  = require( '../helpers/get-template-image-prefix.js' )
const slugFilename            = require( '../../shared/slug-filename.js' )

// used by nightmareJS to have the right html
function renderMarkup(req, res, next) {
  const { templateId }    = req.params

  Templates
  .findById( templateId, 'markup' )
  .then( template => {
    if (!template) return next( createError(404) )
    if (!template.markup) return next( createError(404) )
    return res.send( template.markup )
  })
  .catch( next )
}

// those are 2 links for installing nightmarejs on heroku
// https://github.com/oscarmorrison/nightmare-heroku
// https://github.com/benschwarz/heroku-electron-buildpack
// We make sure that nightmare is connected as admin
const protocol  = `http${ config.forcessl ? 's' : '' }://`
const nightmare = Nightmare()
.viewport(680, 780)
.goto( `${protocol}${config.host}/admin/login` )
.insert( '#password-field', config.admin.password )
.click( 'form[action*="/login"] [type=submit]' )

const connected = nightmare
.evaluate( () => false )
.then( () => {
  return Promise.resolve()
})
.catch( err => {
  console.log( chalk.red(`[PREVIEWS] cannot connect to the server`) )
  console.log( err )
  throw err
})

//
function generatePreviews(req, res, next) {
  const { templateId }  = req.params
  const start           = Date.now()
  const blocksName      = []
  const assets          = {}
  let template

  Templates
  .findById( templateId )
  .then( generate )
  .catch( next )

  function getDuration() {
    return `${ (Date.now() - start) / 1000}s`
  }

  function generate( _template ) {
    console.log(`[PREVIEWS] get template – ${ getDuration() }`)
    if (!_template) return next( createError(404) )
    if (!_template.markup) return next( createError(404) )
    template = _template

    return connected
    .then( () => {
      console.log(`[PREVIEWS] get template markup – ${ getDuration() }`)
      return nightmare
      .goto( `${protocol}${config.host}${template.url.renderMarkup}` )
      // wait for `did-finish-load` event
      // https://github.com/segmentio/nightmare/issues/297#issuecomment-150601269
      .evaluate( () => false )
    })
    .then( getTemplateSize )
    .then( resizeViewport )
    .then( gatherBlocks )
    .then( takeScreenshots )
    .then( saveScreenshotsToTmp )
    .then( uploadScreenshots )
    .then( updateTemplateAssets )
    .then( () => {
      res.redirect( template.url.show )
    })
  }

  function getTemplateSize() {
    console.log(`[PREVIEWS] get template size – ${ getDuration() }`)
    return nightmare
    .evaluate( () => {
      // `preview` class is added to have more controls over previews
      // https://github.com/voidlabs/mosaico/issues/246#issuecomment-265979320
      document.body.classList.add( 'preview' )
      // this is to hide scrollars for screenshots (in case of)
      // https://github.com/segmentio/nightmare/issues/726#issuecomment-232851174
      const s = document.styleSheets[0]
      s.insertRule('::-webkit-scrollbar { display:none; }')
      return {
        width:  Math.round( document.body.scrollWidth ),
        height: Math.round( document.body.scrollHeight ),
      }
    })
  }

  // resize the viewport so it takes the whole template
  // needed for screenshots to be done correctly
  function resizeViewport( {width, height} ) {
    console.log(`[PREVIEWS] resize viewport – ${ getDuration() }`)
    return nightmare
    .viewport(width, height)
    .evaluate( () => false )
  }

  function gatherBlocks() {
    console.log(`[PREVIEWS] gather blocks – ${ getDuration() }`)
    return nightmare
    .evaluate( () => {
      // get position of every blocks
      const nodes   = [ ...document.querySelectorAll('[data-ko-container] [data-ko-block]') ]
      const blocks  = nodes.map( node => {
        // use dataset to preserve case
        const name  = `${node.dataset.koBlock}.png`
        const rect  = node.getBoundingClientRect()
        return {
          name,
          // electron only support integers
          // https://github.com/electron/electron/blob/master/docs/api/structures/rectangle.md
          clip: {
            x:      Math.round( rect.left ),
            y:      Math.round( rect.top ),
            width:  Math.round( rect.width ),
            height: Math.round( rect.height ),
          }
        }
      })
      // add the global view
      blocks.push({
        name: '_full.png',
        clip: {
          x:      0,
          y:      0,
          width:  Math.round( document.body.scrollWidth ),
          height: Math.round( document.body.scrollHeight ),
        }
      })
      return { blocks }
    })
  }

  function takeScreenshots( {blocks} ) {
    console.log(`[PREVIEWS] take screenshots – ${ getDuration() }`)
    console.log( blocks )
    blocks.forEach( ({name}) => blocksName.push( name ) )
    const screens = blocks.map( ({name, clip}) => {
      return nightmare
      .evaluate( () => false )
      .screenshot( clip )
      .then( buffer => Promise.resolve(buffer) )
    })
    return Promise.all( screens )
  }

  function saveScreenshotsToTmp( imagesBuffer ) {
    console.log(`[PREVIEWS] save screenshots to tmp – ${ getDuration() }`)
    const files   = []
    const images  = imagesBuffer.map( (imageBuffer, index) => {
      console.log(`[PREVIEWS] img ${blocksName[ index ]}`)
      // slug to be coherent with upload
      const originalName  = slugFilename( blocksName[ index ] )
      const hash          = crypto.createHash('md5').update( imageBuffer ).digest('hex')
      const name          = `${ getTemplateImagePrefix(templateId) }-${ hash }.png`
      const filePath      = path.join( config.images.tmpDir, `/${name}` )
      files.push({
        path: filePath,
        name,
      })
      // this will be used to update `assets` field in DB
      assets[ originalName ] = name
      return fs.writeFile( filePath, imageBuffer )
    })
    return Promise.all( [files, Promise.all(images)] )
  }

  function uploadScreenshots([files]) {
    console.log(`[PREVIEWS] upload screenshots – ${ getDuration() }`)
    const uploads = files.map( file => {
      console.log(`[PREVIEWS] upload ${file.name}`)
      // images are captured at 680 but displayed at half the size
      const pipeline = sharp().resize( 340, null )
      fs.createReadStream( file.path ).pipe( pipeline )
      return filemanager.writeStreamFromStream( pipeline, file.name )
    })
    return Promise.all( uploads )
  }

  function updateTemplateAssets() {
    console.log(`[PREVIEWS] update template assets in DB – ${ getDuration() }`)
    template.assets  = Object.assign( {}, template.assets || {},  assets )
    template.markModified( 'assets' )
    return template.save()
  }

}

module.exports = {
  renderMarkup,
  generatePreviews,
}
