'use strict'


// Upload's folder structure is meant to be flat
// add a `template` prefix to differ from user uploaded template assets
function getTemplateImagePrefix( templateId ) {
  return `template-${ templateId }`
}

module.exports = getTemplateImagePrefix
