'use strict'

const _                       = require('lodash')
const chalk                   = require('chalk')
const createError             = require('http-errors')

const config                  = require('../config')
const filemanager             = require('../filemanager')
const {
  renderMarkup,
  generatePreviews }          = require('./generatePreviews.js')
const getTemplateImagePrefix  = require('../helpers/get-template-image-prefix.js')
const { formatErrors,
  isFromGroup, Groups,
  Templates, Mailings }       = require('../models')

function list(req, res, next) {
  Templates
  .find( {} )
  .populate('_user')
  .populate('_group')
  .then( templates => {
    res.render('template-list', {
      data: { templates }
    })
  })
  .catch( next )
}

function userList(req, res, next) {
  const isAdmin           = req.user.isAdmin
  const filter            = isAdmin ? {} : { _group: req.user._group }
  const getTemplates     = Templates.find( filter )
  // Admin as a user should see which template is coming from which group
  if (isAdmin) getTemplates.populate('_group')

  getTemplates
  .sort({ name: 1 })
  .then( templates => {
    // can't sort populated fields
    // http://stackoverflow.com/questions/19428471/node-mongoose-3-6-sort-query-with-populated-field/19450541#19450541
    if (isAdmin) {
      templates = templates.sort( (a, b) => {
        let nameA = a._group.name.toLowerCase()
        let nameB = b._group.name.toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0;
      })
    }
    res.render('user-template', {
      data: {
        templates,
      }
    })
  })
  .catch(next)
}

function show(req, res, next) {
  const { groupId, templateId } = req.params

  // CREATE
  if (!templateId) {
    return Groups
    .findById( groupId )
    .then( group => {
      res.render('template-new-edit', { data: { group }} )
    })
    .catch(next)
  }

  // UPDATE
  Templates
  .findById( templateId )
  .populate('_user')
  .populate('_group')
  .then( template => {
    if (!template) return next( createError(404) )
    res.render('template-new-edit', { data: { template, }} )
  })
  .catch(next)
}

function getMarkup(req, res, next) {
  const { templateId } = req.params

  Templates
  .findById( req.params.templateId )
  .then( onTemplate )
  .catch( next )

  function onTemplate(template) {
    if (!isFromGroup(req.user, template._group)) return next(createError(401))
    if (!template.markup) return next(createError(404))
    if (req.xhr) return res.send(template.markup)
    // let download content
    res.setHeader('Content-disposition', `attachment; filename=${template.name}.html`)
    res.setHeader('Content-type', 'text/html')
    res.write(template.markup)
    return res.end()
  }
}

function update(req, res, next) {
  const { templateId } = req.params

  filemanager
  .parseMultipart(req, {
    // add a `template` prefix to differ from user uploaded template assets
    prefix:     getTemplateImagePrefix( templateId ),
    formatter:  'groups',
  })
  .then( onParse )
  .catch(next)

  function onParse( body ) {
    console.log('files success')
    var dbRequest = templateId ?
      Templates.findById( templateId )
      : Promise.resolve( new Templates() )

    dbRequest
    .then( template => {
      const nameChange  = body.name !== template.name
      // custom update function
      template         = _.assignIn(template, _.omit(body, ['images', 'assets']))
      // TODO check if there is any assets to update
      template.assets  = _.assign( {}, template.assets || {}, body.assets )
      template.markModified( 'assets' )

      // copy template name in mailing
      if (templateId && nameChange) {
        Mailings
        .find( { _template: templateId } )
        .then( mailings => {
          mailings.forEach( mailing => {
            mailing.templateName = body.name
            mailing.save().catch( console.log )
          })
        })
        .catch( console.log )
      }
      // return
      return template.save()
    })
    .then( template => {
      console.log('template success', templateId ? 'updated' : 'created')
      req.flash('success', templateId ? 'updated' : 'created')
      return res.redirect(template.url.show)
    })
    .catch( err => formatErrors(err, req, res, next) )
  }
}

function remove(req, res, next) {
  const { templateId } = req.params

  Mailings
  .find( {_template: templateId} )
  .then( mailings => {
    console.log(mailings.length, 'to remove')
    mailings = mailings.map( mailing => mailing.remove() )
    return Promise.all(mailings)
  })
  .then( deletedMailings => Templates.findByIdAndRemove( templateId ) )
  .then( deletedTemplate => res.redirect(req.query.redirect) )
  .catch( next )
}

module.exports = {
  list,
  userList,
  show,
  update,
  remove,
  getMarkup,
  generatePreviews,
  renderMarkup,
}
