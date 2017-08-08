'use strict'

const _                       = require( 'lodash' )
const createError             = require( 'http-errors' )

const config                  = require( '../config' )
const filemanager             = require( '../filemanager' )
const slugFilename            = require( '../../shared/slug-filename.js' )
const {
  renderMarkup,
  generatePreviews,
  nightmareInstance,
  startNightmare }            = require( './generate-previews' )
const { autoUpload }          = require( './auto-upload' )
const h                       = require( '../helpers' )
const { addGroupFilter }      = require('../models')

async function list(req, res, next) {
  const { Template, Group } = req.app.get( 'models' )
  const reqParams   = {
    order: [
      ['createdAt', 'DESC'],
    ],
    include: [{
      model: Group,
    }],
  }
  const templates = await Template.findAll( reqParams )
  res.render( 'template-list', {data: { templates }} )
}

async function create(req, res, next) {
  const { Group } = req.app.get( 'models' )
  const { groupId } = req.params
  const group       = await Group.findById( groupId )
  if ( !group ) return next( createError(404) )
  res.render( 'template-new-edit', {data: { group, }} )
}

async function show(req, res, next) {
  const { Template, Group } = req.app.get( 'models' )
  const { templateId }  = req.params
  const reqParams       = {
    where: {
      id: templateId,
    },
    include: [{
      model:    Group,
    }],
  }
  const template        = await Template.findOne( reqParams )
  if ( !template ) return next( createError(404) )
  res.render('template-new-edit', { data: {
    template,
    group: template.group,
  }} )
}

async function update(req, res, next) {
  const { Template }    = req.app.get( 'models' )
  const { templateId }  = req.params
  const isUpdate        = typeof templateId !== 'undefined'
  const parseParams     = {
    // add a `template` prefix to differ from user uploaded template assets
    prefix:     h.getTemplateImagePrefix( templateId ),
    formatter:  'groups',
  }
  const body      = await filemanager.parseMultipart( req, parseParams )
  // Don't use upsert as it didn't return an instance but only a status
  // http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-upsert
  const template  = await ( isUpdate ? Template.findById(templateId) : new Template() )
  if ( isUpdate && !template ) return next( createError(404) )
  const newDatas          = _.omit( body, ['images'] )
  if ( isUpdate ) {
    const templateAssets  = template.assets
    newDatas.assets       = _.assign( {}, templateAssets || {}, newDatas.assets )
  }
  const udpatedTemplate = await template.update( newDatas )
  const message         = isUpdate ? 'updated' : 'created'
  req.flash( 'success', message )
  return res.redirect( template.url.show )
}

async function remove(req, res, next) {
  const { Template, Mailing, Gallery } = req.app.get( 'models' )
  const { templateId }  = req.params
  const { redirect }    = req.query
  const tmplParams      = {
    where: { id:  templateId },
    include: [{
      model:    Mailing,
      required: false,
    }]
  }
  const template        = await Template.findOne( tmplParams )
  if ( !template ) return next( createError(404) )
  const mailingParams   = {
    where: { templateId },
  }
  const galleryParams   = {
    where: {
      templateId,
      $or: {
        mailingId: { $in: template.mailings.map( mailing => mailing.id) }
      },
    },
  }
  const dbRequests = [
    template.destroy(),
    Mailing.destroy( mailingParams ),
    Gallery.destroy( galleryParams ),
  ]
  const result          = await Promise.all( dbRequests )
  res.redirect( redirect )
}

//----- USER ACTIONS

async function getMarkup(req, res, next) {
  const { Template }    = req.app.get( 'models' )
  const { templateId }  = req.params
  const reqParams       = {
    where: {
      id: templateId,
    },
  }
  const template        = await Template.findOne( addGroupFilter(req, reqParams) )
  if ( !template || !template.markup ) return next( createError(404) )
  const markup          = template.get( 'markup' )
  if (req.xhr) return res.send( markup )
  // let download content
  const filename = `${ template.get('name') }.html`
  res.setHeader( 'Content-disposition', `attachment; filename=${ slugFilename( filename ) }` )
  res.setHeader( 'Content-type', 'text/html' )
  res.write( markup )
  return res.end()
}

async function userList(req, res, next) {
  const { Template, Group }   = req.app.get( 'models' )
  const { isAdmin, groupId }  = req.user
  const reqParams             = {
    include: [{
      model: Group,
    }],
    order: [
      [ Group, 'name', 'ASC' ],
      [ 'name', 'ASC' ],
    ],
  }
  const templates             = await Template.findAll( addGroupFilter(req, reqParams) )
  res.render( 'mailing-new', {data: { templates }} )
}

//----- EXPORTS

module.exports = {
  list:               h.asyncMiddleware( list ),
  new:                h.asyncMiddleware( create ),
  show:               h.asyncMiddleware( show ),
  update:             h.asyncMiddleware( update ),
  remove:             h.asyncMiddleware( remove ),
  getMarkup:          h.asyncMiddleware( getMarkup ),
  autoUpload:         h.asyncMiddleware( autoUpload ),
  renderMarkup:       h.asyncMiddleware( renderMarkup ),
  generatePreviews:   h.asyncMiddleware( generatePreviews ),

  userList:           h.asyncMiddleware( userList ),

  nightmareInstance,
  startNightmare,
}
