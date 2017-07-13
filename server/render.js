'use strict'

function adminLogin(req, res, next) {
  res.render('password-admin-login')
}

function login(req, res, next) {
  return res.render('password-login')
}

function forgot(req, res, next) {
  return res.render('password-forgot')
}

module.exports = {
  adminLogin,
  login,
  forgot,
}
