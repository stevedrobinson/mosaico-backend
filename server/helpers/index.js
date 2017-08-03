'use strict'

const defer           = require( './create-promise' )
const asyncMiddleware = require( './async-middleware' )

function normalizeString(string) {
  string = `${string}`
  return string.trim().toLowerCase()
}

// Upload's folder structure is meant to be flat
// add a `template` prefix to differ from user uploaded template assets
function getTemplateImagePrefix( templateId ) {
  return `template-${ templateId }`
}

// used to have a proper file name for jQuery Fileupload
const thumbnailSize = `111x111`
function formatFileuploadName( filename ) {
  return {
    name:         filename,
    url:          `/img/${ filename }`,
    deleteUrl:    `/img/${ filename }`,
    thumbnailUrl: `/cover/${ thumbnailSize }/${filename}`,
  }
}

module.exports = {
  defer,
  normalizeString,
  getTemplateImagePrefix,
  formatFileuploadName,
  asyncMiddleware,
}
