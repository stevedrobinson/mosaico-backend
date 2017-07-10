'use strict'

const chalk                 = require('chalk')
const createError           = require('http-errors')
const { merge }             = require('lodash')

const config                = require('./config')
const { handleValidatorsErrors,
  Groups, Users,
  Templates, Mailings }   = require('./models')

function list(req, res, next) {
  Users
  .find( {} )
  .populate( '_group' )
  .sort( { isDeactivated: 1, createdAt: -1 } )
  .then( users => {
    return res.render('user-list', {
      data: { users }
    })
  })
  .catch( next )
}

function show(req, res, next) {
  // group is for member mailing…
  // …userId when it's created :)
  const { groupId, userId } = req.params

  // CREATE
  if (groupId) {
    Groups
    .findById(groupId)
    .then( group => {
      res.render('user-new-edit', { data: {
        group,
      }})
    })
    .catch(next)
    return
  }

  const getUser       = Users.findById(userId).populate('_group')
  const getMailings  = Mailings.find( { _user: userId } ).populate('_template')

  // UPDATE
  Promise
  .all([getUser, getMailings])
  .then( (dbResponse) => {
    const user      = dbResponse[0]
    const mailings = dbResponse[1]
    if (!user) return next(createError(404))
    res.render('user-new-edit', { data: {
      user:       user,
      mailings:  mailings,
    }})
  })
  .catch(next)
}

function update(req, res, next) {
  const { body }    = req
  const { userId }  = req.params
  const dbRequest   = userId ?
    Users.findById(userId)
    : Promise.resolve(new Users(body))

  dbRequest
  .then(handleUser)
  .catch(next)

  function handleUser(user) {
    const nameChange  = body.name !== user.name
    user              = merge(user, body)
    user
    .save()
    .then( user => res.redirect( user.url.show ) )
    .catch( err => handleValidatorsErrors(err, req, res, next) )

    // copy user name attribute in mailing author
    if (userId && nameChange) {
      Mailings
      .find({_user: userId})
      .then( mailings => {
        mailings.forEach( mailing => {
          mailing.author = body.name
          mailing.save().catch(console.log)
        })
      })
      .catch(console.log)
    }
  }
}

function activate(req, res, next) {
  const { userId }    = req.params
  const { redirect }  = req.query

  Users
  .findById( userId )
  .then( handleUser )
  .catch( next )

  function handleUser(user) {
    user
    .activate()
    .then( user => res.redirect( redirect ? redirect : '/users' ) )
    .catch( next )
  }

}

function deactivate(req, res, next) {
  const { userId }    = req.params
  const { redirect }  = req.query

  Users
  .findById( userId )
  .then( handleUser )
  .catch( next )

  function handleUser(user) {
    user
    .deactivate()
    .then( user => res.redirect( redirect ? redirect : '/users' ) )
    .catch( next )
  }
}

function adminResetPassword(req, res, next) {
  const { id } = req.body

  Users
  .findById(id)
  .then(handleUser)
  .catch(next)

  function handleUser(user) {
    if (!user) return next(createError(404))
    user
    .resetPassword(user.lang, 'admin')
    .then(user => {
      // reset from elsewhere
      if (req.body.redirect) return res.redirect(req.body.redirect)
      // reset from group page
      res.redirect(user.url.group)
    })
    .catch(next)
  }
}

function userResetPassword(req, res, next) {
  Users
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
  Users
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
  Users
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
  list,
  show,
  update,
  activate,
  deactivate,
  adminResetPassword,
  userResetPassword,
  setPassword,
  showSetPassword,
}
