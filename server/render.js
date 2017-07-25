'use strict'

const config  = require( './config' )

function adminLogin(req, res, next) {
  res.render('password-admin-login')
}

function login(req, res, next) {
  return res.render('password-login')
}

function forgot(req, res, next) {
  return res.render('password-forgot')
}

function about(req, res, next) {
  res.json( config.about )
}

module.exports = {
  adminLogin,
  login,
  forgot,
  about,
}
