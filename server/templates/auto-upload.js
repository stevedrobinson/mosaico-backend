'use srict'

const path          = require( 'path' )
const chalk         = require( 'chalk' )
const fs            = require( 'fs-extra' )

const { Templates } = require('../models')

const tmplsRootPath = path.join( __dirname, '../../templates' )
const tmplsPath     = {
  'tedc15': {
    html:   path.join( tmplsRootPath, '/tedc15/template-tedc15.html' ),
    images: false,
  },
  'versafix-1': {
    html:   path.join( tmplsRootPath, '/versafix-1/template-versafix-1.html' ),
    images: path.join( tmplsRootPath, '/versafix-1/img' ),
  }
}

function autoUpload(req, res, next) {
  const {
    templateId,
    templateName }  = req.params
  const redirectUrl = `/templates/${templateId}`

  if (!templateName in tmplsPath) return res.redirect( redirectUrl )

  const tmplPath    = tmplsPath[templateName]
  const dbRequest   = Templates.findById( templateId )
  const htmlRequest = fs.readFile( tmplPath.html, 'utf8' )

  Promise
  .all( [dbRequest, htmlRequest] )
  .then( ([template, markup]) => {
    // console.log( markup )
    template.markup = markup
    return template.save()
  })
  .then( template => {
    res.redirect( redirectUrl )
  })
  .catch( next )
}

module.exports = {
  autoUpload,
}
