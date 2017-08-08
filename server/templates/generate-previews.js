'use strict'

const Nightmare               = require( 'nightmare' )
const createError             = require( 'http-errors' )
const crypto                  = require( 'crypto' )
const path                    = require( 'path' )
const chalk                   = require( 'chalk' )
const sharp                   = require( 'sharp' )
const fs                      = require( 'fs-extra' )

const config                  = require( '../config' )
const filemanager             = require( '../filemanager' )
const slugFilename            = require( '../../shared/slug-filename' )
const { defer,
  getTemplateImagePrefix }    = require( '../helpers' )

// used by nightmareJS to have the right html
async function renderMarkup(req, res, next) {
  const { Template }      = req.app.get( 'models' )
  const { templateId }    = req.params
  const reqParams         = {
    attributes: ['markup']
  }
  const template          = await Template.findById( templateId, reqParams )
  if ( !template || !template.markup ) return next( createError(404) )
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': 0,
    'Content-Type': 'text/html',
  })
  return res.send( template.markup )
}

// those are 2 links for installing nightmarejs on heroku
// https://github.com/oscarmorrison/nightmare-heroku
// https://github.com/benschwarz/heroku-electron-buildpack
// We make sure that nightmare is connected as admin
const protocol  = `http${ config.forcessl ? 's' : '' }://`
const nightmare = Nightmare().viewport(680, 780)
const connected = defer()

function startNightmare() {
  nightmare
  .goto( `${protocol}${config.host}/admin/login` )
  .insert( '#password-field', config.admin.password )
  .click( 'form[action*="/login"] [type=submit]' )
  .evaluate( () => false )
  .then( () => {
    return connected.resolve()
  })
  .catch( err => {
    console.log( chalk.red(`[PREVIEWS] cannot connect to the server`) )
    console.log( err )
    connected.reject( err )
    throw err
  })
}

//
async function generatePreviews(req, res, next) {
  const { Template }      = req.app.get( 'models' )
  const { templateId }    = req.params
  const start             = Date.now()
  const blocksName        = []
  const assets            = {}
  const template          = await Template.findById( templateId )
  if ( !template || !template.markup ) return next( createError(404) )
  function getDuration() {
    return `${ (Date.now() - start) / 1000}s`
  }
  console.log(`[PREVIEWS] get template – ${ getDuration() }`)
  const isConnected       = await connected

  console.log(`[PREVIEWS] get template markup – ${ getDuration() }`)
  const renderMarkup      = nightmare
    // add a param to force cache reload
    .goto( `${protocol}${config.host}${template.url.renderMarkup}?t=${new Date().valueOf()}` )
    // wait for `did-finish-load` event
    // https://github.com/segmentio/nightmare/issues/297#issuecomment-150601269
    .evaluate( () => false )
  const isMarkupRendered  = await renderMarkup

  console.log( `[PREVIEWS] get template size – ${ getDuration() }` )
  const getTemplateSize   = nightmare
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
  const {width, height}   = await getTemplateSize

  // resize the viewport so it takes the whole template
  // needed for screenshots to be done correctly
  console.log(`[PREVIEWS] resize viewport – ${ getDuration() }`)
  const resizeViewport    = nightmare
    .viewport(width, height)
    .evaluate( () => false )
  const isResized         = await resizeViewport

  console.log(`[PREVIEWS] gather blocks – ${ getDuration() }`)
  const gatherBlocks      = nightmare
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
  let { blocks }          = await gatherBlocks

  console.log(`[PREVIEWS] take screenshots – ${ getDuration() }`)
  console.log( blocks )
  blocks.forEach( ({name}) => blocksName.push( name ) )
  const wholePage         = blocks[ blocks.length - 1 ]
  const getScreenBuffer   = nightmare
    .evaluate( () => false )
    .screenshot( wholePage.clip )
  const screenBuffer      = await getScreenBuffer

  console.log(`[PREVIEWS] save screenshots to tmp – ${ getDuration() }`)
  blocks = blocks.map( block => {
    const { clip } = block
    return sharp( screenBuffer )
    .extract( {
      left:   clip.x,
      top:    clip.y,
      width:  clip.width,
      height: clip.height,
    } )
    // images are captured at 680 but displayed at half the size
    .resize( 340, null )
    .toBuffer( )
  })
  const imagesBuffer      = await Promise.all( blocks )

  const files             = []
  const images            = imagesBuffer.map( (imageBuffer, index) => {
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
  const imagesWritten     = await Promise.all( images )

  console.log(`[PREVIEWS] upload screenshots – ${ getDuration() }`)
  const uploads = files.map( file => {
    console.log(`[PREVIEWS] upload ${file.name}`)
    return filemanager.writeStreamFromPath( file )
  })
  const allUploadDone     = await Promise.all( uploads )

  console.log(`[PREVIEWS] update template assets in DB – ${ getDuration() }`)
  template.assets         = Object.assign( {}, template.assets || {},  assets )
  const updatedTemplate   = await template.save()

  res.redirect( template.url.show )
}

module.exports = {
  renderMarkup,
  generatePreviews,
  nightmareInstance: nightmare,
  startNightmare,
}
