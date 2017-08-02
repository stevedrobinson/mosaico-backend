'use strict'

const createError         = require( 'http-errors' )

const h                   = require( '../helpers' )
const { inspect }         = require( 'util' )

const {
  Mailing,
  User,
  Group,
  Template,
  addStrictGroupFilter,
}                         = require('../models')

async function get(req, res, next) {
  const { mailingId } = req.params
  const reqParams     = {
    where: {
      id: mailingId,
    },
    include: [{
      model: Template,
      include: [{
        model: Group,
        include: [{
          model:    User,
          required: false,
          where: {
            isDeactivated: { $not: true },
          },
        }]
      }]
    }]
  }
  const mailing = await Mailing.findOne( addStrictGroupFilter(req, reqParams) )

  if ( !mailing ) return next( createError(404) )
  return res.render('mailing-transfer', {
    data: {
      mailing,
      users: mailing.template.group.users,
    },
  })
}

async function post(req, res, next) {
  const { userId }      = req.body
  const { mailingId }   = req.params
  const userQuery       = User.findById( userId )
  const mailingQuery    = Mailing.findById( mailingId )

  const [user, mailing] = await Promise.all( [userQuery, mailingQuery] )
  if (!user) return next( createError(404, 'no user founded') )
  if (!mailing) return next( createError(404, 'no mailing founded') )
  const update          = await mailing.update({
    userId:   user.id,
    groupId:  user.groupId,
  })
  res.redirect('/')
}

module.exports = {
  get:  h.asyncMiddleware( get ),
  post: h.asyncMiddleware( post ),
}
