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
const { formatErrors,
  isFromGroup,
  Group,
  Template,
  // Mailings
}       = require('../models')

async function list(req, res, next) {
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
  const { groupId } = req.params
  const group       = await Group.findById( groupId )
  if ( !group ) return next( createError(404) )
  res.render( 'template-new-edit', {data: { group, }} )
}

async function show(req, res, next) {
  const { templateId }  = req.params
  const reqParams       = {
    where: {
      id: templateId,
    },
    include: [{
      model: Group,
    }],
  }
  const template        = await Template.findOne( reqParams )
  if ( !template ) return next( createError(404) )
  res.render('template-new-edit', { data: {
    template,
    group: template.group,
  }} )
}

async function getMarkup(req, res, next) {
  const { templateId }  = req.params
  const { isAdmin }     = req.user
  const reqParams       = {
    where: {
      id: templateId,
    },
    attributes: ['name', 'markup', 'groupId'],
  }
  if ( !isAdmin ) reqParams.where.groupId = req.user.groupId

  const template        = await Template.findById( templateId )
  if ( !template || !template.markup ) return next( createError(404) )
  const markup          = template.get( 'markup' )
  if (req.xhr) return res.send( markup )
  // let download content
  console.log(template.get('name'))
  const filename = `${ template.get('name') }.html`
  res.setHeader( 'Content-disposition', `attachment; filename=${ slugFilename( filename ) }` )
  res.setHeader( 'Content-type', 'text/html' )
  res.write( markup )
  return res.end()
}

async function update(req, res, next) {
  const { templateId }  = req.params
  const isUpdate        = typeof templateId !== 'undefined'
  const parseParams     = {
    // add a `template` prefix to differ from user uploaded template assets
    prefix:     h.getTemplateImagePrefix( templateId ),
    formatter:  'groups',
  }
  const body      = await filemanager.parseMultipart( req, parseParams )
  // TODO should use upsert
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
  const { templateId }  = req.params
  const { redirect }    = req.query

  const tmplParams      = {
    where: {
      id: templateId
    },
  }
  const mailingParams   = {
    where: { templateId },
  }
  const removedTemplate = await Template.destroy( tmplParams )
  // const removedMailings = await Mailing.destroy( mailingParams )
  res.redirect( req.query.redirect )
}

//----- USER ACTIONS

function userList(req, res, next) {
  const { isAdmin }       = req.user
  const filter            = isAdmin ? {} : { _group: req.user._group }
  // const getTemplate     = Template.find( filter )
  // // Admin as a user should see which template is coming from which group
  // if (isAdmin) getTemplate.populate('_group')

  // getTemplate
  // .sort({ name: 1 })
  // .then( templates => {
  //   // can't sort populated fields
  //   // http://stackoverflow.com/questions/19428471/node-mongoose-3-6-sort-query-with-populated-field/19450541#19450541
  //   if (isAdmin) {
  //     templates = templates.sort( (a, b) => {
  //       let nameA = a._group.name.toLowerCase()
  //       let nameB = b._group.name.toLowerCase()
  //       if (nameA < nameB) return -1
  //       if (nameA > nameB) return 1
  //       return 0;
  //     })
  //   }
  //   resrender('mailing-show, {
  //     data: {
  //       templates,
  //     }
  //   })
  // })
  // .catch(next)
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
  nightmareInstance,
  startNightmare,
  userList,
}
