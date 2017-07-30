'use strict'

const createError           = require( 'http-errors' )
const { merge }             = require( 'lodash' )

const config                = require( './config' )
const h                     = require( './helpers' )
const { handleValidatorsErrors,
  Group, User,
  // Templates, Mailings
}   = require('./models')

async function list(req, res, next) {
  const reqParams   = {
    order: [
      ['createdAt',     'DESC'],
      ['isDeactivated', 'ASC'],
    ],
    include: [{
      model: Group,
    }],
  }
  const users = await User.findAll( reqParams )
  res.render('user-list', {
    data: { users }
  })
}

async function create(req, res, next) {
  const { groupId } = req.params
  const group       = await Group.findById( groupId )
  if ( !group ) return next( createError(404) )
  res.render( 'user-new-edit', {data: { group }} )
}

async function show(req, res, next) {
  const { userId }  = req.params
  const reqParams   = {
    where: {
      id: userId,
    },
    include: [{
      model: Group,
    }],
  }
  const user        = await User.findOne( reqParams )
  if ( !user ) return next( createError(404) )
  res.render('user-new-edit', { data: {
    user,
    group:    user.group,
    mailings:   [],
  }})

  // const getMailings  = Mailings.find( { _user: userId } ).populate('_template')

  // // UPDATE
  // Promise
  // .all([getUser, getMailings])
  // .then( (dbResponse) => {
  //   const user      = dbResponse[0]
  //   const mailings = dbResponse[1]
  //   res.render('user-new-edit', { data: {
  //     user:       user,
  //     mailings:  mailings,
  //   }})
  // })
  // .catch(next)
}

async function update( req, res, next ) {
  const { userId }  = req.params
  const { body }    = req
  // TODO should use upsert
  // http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-upsert
  const user        = await User.findByIdAndUpdate( userId, body )
  if ( !user ) return next( createError(404) )
  res.redirect( user.url.show )
}

async function activate( req, res, next ) {
  const { userId }    = req.params
  const { redirect }  = req.query
  const user          = await User.findById( userId )
  if ( !user ) return next( createError(404) )
  const activation    = await user.activate()
  res.redirect( redirect ? redirect : '/users' )
}

async function deactivate(req, res, next) {
  const { userId }    = req.params
  const { redirect }  = req.query
  const user          = await User.findById( userId )
  if ( !user ) return next( createError(404) )
  const deactivation  = await user.deactivate()
  res.redirect( redirect ? redirect : '/users' )
}

async function adminResetPassword( req, res, next ) {
  const { userId }    = req.params
  const { redirect }  = req.query
  const user          = await User.findById( userId )
  if ( !user ) return next( createError(404) )
  const reset         = await user.resetPassword( 'admin' )
  res.redirect( redirect ? redirect : user.url.group )
}

//----- USER ACTIONS

async function userResetPassword(req, res, next) {
  const { username }  = req.body
  const reqParams     = {
    where: {
      email: h.normalizeString( username )
    }
  }
  const user          = await User.findOne( reqParams )
  if ( !user ) {
    req.flash( 'error', 'invalid email' )
    return res.redirect( '/forgot' )
  }
  const resetedUser   = await user.resetPassword( 'user' )
  // TODO: I18N
  req.flash( 'success', 'password has been reseted. You should receive an email soon' )
  res.redirect( '/forgot' )
}

async function setPassword(req, res, next) {
  const { token }   = req.params
  const reqParams   = {
    where: {
      token:        token,
      tokenExpire:  { $gt: Date.now() },
    }
  }
  const user        = await User.findOne( reqParams )
  if (!user) {
    req.flash( 'error', {message: 'password.token.invalid'} )
    return res.redirect( req.path )
  }
  if (req.body.password !== req.body.passwordconfirm) {
    req.flash( 'error', {message: 'password.nomatch'} )
    return res.redirect( req.path )
  }
  const updatedUser = await user.setPassword( req.body.password )
  req.login(updatedUser, err => {
    if (err) return next(err)
    res.redirect('/')
  })
}

async function showSetPassword(req, res, next) {
  const { token }   = req.params
  const reqParams   = {
    where: {
      token:        token,
      tokenExpire:  { $gt: Date.now() },
    }
  }
  const user        = await User.findOne( reqParams )
  const data        = !user ? { noToken: true } : { token }
  return res.render( 'password-reset', { data } )
}

//----- EXPORTS

module.exports = {
  list:               h.asyncMiddleware( list ),
  show:               h.asyncMiddleware( show ),
  new:                h.asyncMiddleware( create ),
  update:             h.asyncMiddleware( update ),
  activate:           h.asyncMiddleware( activate ),
  deactivate:         h.asyncMiddleware( deactivate ),
  adminResetPassword: h.asyncMiddleware( adminResetPassword ),
  userResetPassword:  h.asyncMiddleware( userResetPassword ),
  setPassword:        h.asyncMiddleware( setPassword ),
  showSetPassword:    h.asyncMiddleware( showSetPassword ),
}
