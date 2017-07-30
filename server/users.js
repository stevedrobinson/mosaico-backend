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

function userResetPassword(req, res, next) {
  User
  .findOne({
    email: req.body.username
  })
  .then(onUser)
  .catch(next)

  function onUser(user) {
    if (!user) {
      req.flash('error', 'invalid email')
      return res.redirect('/forgot')
    }
    user
    .resetPassword(req.getLocale(), 'user')
    .then( user => {
      req.flash('success', 'password has been reseted. You should receive an email soon')
      res.redirect('/forgot')
    })
    .catch(next)
  }
}

function setPassword(req, res, next) {
  User
  .findOne({
    token:        req.params.token,
    tokenExpire:  { $gt: Date.now() },
  })
  .then( user => {
    if (!user) {
      req.flash('error', {message: 'password.token.invalid'})
      res.redirect(req.path)
      return Promise.resolve(false)
    }
    if (req.body.password !== req.body.passwordconfirm) {
      req.flash('error', {message: 'password.nomatch'})
      res.redirect(req.path)
      return Promise.resolve(false)
    }
    return user.setPassword(req.body.password, req.getLocale())
  })
  .then( user => {
    if (!user) return
    req.login(user, err => {
      if (err) return next(err)
      res.redirect('/')
    })

  })
  .catch(next)
}

function showSetPassword(req, res, next) {
  const { token } = req.params
  User
  .findOne( {
    token,
    tokenExpire: { $gt: Date.now() },
  } )
  .then( user => {
    const data = !user ? { noToken: true } : { token }
    return res.render( 'password-reset', { data } )
  })
  .catch( next )
}

module.exports = {
  list:               h.asyncMiddleware( list ),
  show:               h.asyncMiddleware( show ),
  new:                h.asyncMiddleware( create ),
  update:             h.asyncMiddleware( update ),
  activate:           h.asyncMiddleware( activate ),
  deactivate:         h.asyncMiddleware( deactivate ),
  adminResetPassword: h.asyncMiddleware( adminResetPassword ),
  userResetPassword,
  setPassword,
  showSetPassword,
}
