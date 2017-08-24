'use strict'

const chalk       = require( 'chalk' )
const createError = require( 'http-errors' )

const config      = require( './config' )
const h           = require( './helpers' )
const { Group,
  User,
  Template,
  Mailing, }      = require( './models' )

async function list(req, res, next) {
  const reqParams = {
    order: [
      ['name', 'ASC'],
    ],
  }
  const groups = await Group.findAll( reqParams )
  res.render('group-list', {
    data: { groups }
  })
}

async function show(req, res, next) {
  const { groupId } = req.params
  if ( !groupId ) return res.render('group-new-edit')
  const reqParams   = {
    where: {
      id: groupId,
    },
    include: [{
      model:    User,
      required: false,
      order: [
        ['isDeactivated', 'DESC'],
        ['name', 'DESC'],
      ],
    }, {
      model:    Template,
      required: false,
      order: [
        ['createdAt', 'DESC']
      ],
    },
    {
      model:    Mailing,
      required: false,
      order: [
        ['createdAt', 'DESC']
      ],
      include: [{
        model:  User,
      }, {
        model:  Template,
      }],
    }],
  }
  const group       = await Group.findOne( reqParams )
  if ( !group ) return next( createError(404) )
  res.render('group-new-edit', {
    data: {
      group,
      users:      group.users,
      templates:  group.templates,
      mailings:   group.mailings,
    },
  })
}

async function update(req, res, next) {
  const { groupId } = req.params
  const { body }    = req
  const group       = await Group.updateOrCreate( groupId, body )
  if ( !group ) return next( createError(404) )
  res.redirect( group.url.show )
}

module.exports = {
  list:   h.asyncMiddleware( list ),
  show:   h.asyncMiddleware( show ),
  update: h.asyncMiddleware( update ),
}
