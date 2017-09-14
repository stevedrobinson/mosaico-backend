'use strict'

const { extend, pick }  = require( 'lodash' )
const chalk             = require( 'chalk' )
const nodemailer        = require( 'nodemailer' )
const wellknown         = require( 'nodemailer-wellknown' )
const createError       = require( 'http-errors' )

const config            = require( './config' )

let mailConfig    = config.emailTransport
if (mailConfig.service) {
  mailConfig      = extend({}, mailConfig, wellknown(mailConfig.service))
  delete mailConfig.service
}

const transporter = nodemailer.createTransport(config.emailTransport)

function send(options) {
  var mailOptions = extend({}, options, pick( config.emailOptions, ['from'] ) )
  return new Promise(function (resolve, reject) {
    transporter
    .sendMail(mailOptions)
    .then( info => {
      console.log(chalk.green('email send to', info.accepted))
      resolve(info)
    })
    .catch( err => {
      console.log(chalk.red('email error'))
      const message = err.code === 'ECONNREFUSED' ?
      'smtp connection failed'
      : 'email error'
      reject(createError(500, message))
    })
  })
}

module.exports = {
  transporter,
  send,
  status: transporter.verify,
}
