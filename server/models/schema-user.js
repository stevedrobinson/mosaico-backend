'use strict'

const { assign }    = require('lodash')
const fs            = require('fs')
const path          = require('path')
const { Schema }    = require('mongoose')
const { ObjectId }  = Schema.Types
const tmpl          = require('blueimp-tmpl')
const bcrypt        = require('bcryptjs')
const validator     = require('validator')
const randtoken     = require('rand-token')
const moment        = require('moment')

const config              = require( '../config' )
const mail                = require( '../mail' )
const defer               = require( '../helpers/create-promise' )
const { normalizeString } = require( './utils' )
const { GroupModel }      = require( './names' )


const { brand }           = config

//////
// USER
//////

const UserSchema    = Schema({
  name: {
    type:     String,
    set:      normalizeString,
  },
  email: {
    type:     String,
    required: [true, 'Email address is required'],
    // http://mongoosejs.com/docs/api.html#schematype_SchemaType-unique
    // from mongoose doc:
    // violating the constraint returns an E11000 error from MongoDB when saving, not a Mongoose validation error.
    unique:   true,
    validate: [{
      // Don't pass directly validator.isEmail
      // 2 arguments validators are now considered as `async` and raise a warning
      // http://mongoosejs.com/docs/validation.html#async-custom-validators
      validator: value => validator.isEmail(value),
      message:  '{VALUE} is not a valid email address',
    }],
    set:      normalizeString,
  },
  _group: {
    type:     ObjectId,
    ref:      GroupModel,
    required: [true, 'Group is required'],
  },
  password:   {
    type:     String,
    set:      encodePassword,
  },
  lang: {
    type:     String,
    default: 'en',
  },
  token: {
    type:     String,
  },
  tokenExpire: {
    type:     Date,
  },
  isDeactivated: {
    type:     Boolean,
    default:  false,
  },
}, { timestamps: true })

function encodePassword(password) {
  if (typeof password === 'undefined') return void(0)
  return bcrypt.hashSync(password, 10)
}

UserSchema.virtual('status').get(function () {
  const status = this.isDeactivated ? '-2' : this.password ? 1 : this.token ? 0 : -1
  const values = {
    '-2': {
      value:          'admin.users.status.value.deactivated',
      icon:           'airline_seat_individual_suite',
      actionMsg:      'admin.users.status.action-long.activate',
      actionMsgShort: 'admin.users.status.action-short.activate',
    },
    '-1': {
      // value:          'to be initialized',
      value:          'admin.users.status.value.to-be-initialized',
      icon:           'report_problem',
      // actionMsg:      'send password mail',
      // actionMsgShort: 'send',
      actionMsg:      'admin.users.status.action-long.send',
      actionMsgShort: 'admin.users.status.action-short.send',
    },
    '0': {
      // value:          'password mail sent',
      value:          'admin.users.status.value.password-mail-sent',
      icon:           'schedule',
      // actionMsg:      'resend password mail',
      // actionMsgShort: 'resend',
      actionMsg:      'admin.users.status.action-long.resend',
      actionMsgShort: 'admin.users.status.action-short.resend',
    },
    '1': {
      value:          'admin.users.status.value.confirmed',
      icon:           'check',
      // actionMsg:      'reset password',
      // actionMsgShort: 'reset',
      actionMsg:      'admin.users.status.action-long.reset',
      actionMsgShort: 'admin.users.status.action-short.reset',
    },
  }
  return values[ status ]
})

UserSchema.virtual('fullname').get(function () {
  return this.name ? `${this.name} (${this.email})` : this.email
})

UserSchema.virtual('safename').get(function () {
  return this.name ? this.name : '—'
})

UserSchema.virtual('isReseted').get(function () {
  if (this.password)  return false
  if (this.token)     return true
  return false
})

// for better session handling
UserSchema.virtual('isAdmin').get(function () {
  return false
})

UserSchema.virtual('url').get(function () {
  let groupId   = this._group && this._group._id ? this._group._id : this._group
  return {
    show:     `/users/${this._id}`,
    delete:   `/users/${this._id}?_method=DELETE`,
    restore:  `/users/${this._id}/restore`,
    group:    `/groups/${groupId}`,
  }
})

UserSchema.methods.activate = function activate() {
  var user            = this
  user.isDeactivated  = false
  return user.save()
}

UserSchema.methods.deactivate = function deactivate() {
  var user            = this
  user.password       = void(0)
  user.token          = void(0)
  user.isDeactivated  = true

  return user.save()
}

UserSchema.methods.resetPassword = function resetPassword(lang, type) {
  const deferred    = defer()
  const user        = this
  user.password     = void(0)
  user.token        = randtoken.generate(30)
  user.tokenExpire  = moment().add(1, 'weeks')
  lang              = lang ? lang : 'en'
  const isEn        = lang === 'en'

  user
  .save()
  .then( onSave )
  .catch( deferred.reject )

  function onSave(updatedUser) {
    const subject = isEn ? 'password reset' : 'réinitialisation de mot de passe'
    const text    = isEn ? `here is the link to enter your new password` :
      `voici le lien pour réinitialiser votre mot de passe`

    return mail
    .send({
      to:       updatedUser.email,
      subject:  `${ brand.name } – ${ subject }`,
      text:     `${ text } http://${ config.host }/password/${ user.token }`,
      html:     tmpReset(getTemplateData('reset-password', lang, {
        type: type,
        url:  `http://${config.host}/password/${user.token}?lang=${lang}`,
      })),
    })
    .then( _ => deferred.resolve(updatedUser) )
    .catch( deferred.reject )
  }

  return deferred
}

UserSchema.methods.setPassword = function setPassword(password, lang) {
  const deferred    = defer()
  const user        = this
  user.token        = void(0)
  user.tokenExpire  = void(0)
  user.password     = password
  lang              = lang ? lang : 'en'
  const isEn        = lang === 'en'

  user
  .save()
  .then(onSave)
  .catch(deferred.reject)

  function onSave(updatedUser) {
    const subject = isEn ? 'password reset' : 'réinitialisation de mot de passe'
    const text    = isEn ? `your password has been succesfully been reseted. connect at` :
      `Votre mot de passe à bien été réinitialisé. Connectez-vous à l'adresse suivante :`

    return mail
    .send({
      to:       updatedUser.email,
      subject:  `${ brand.name } – ${ subject }`,
      text:     `${ text } http://${config.host}/login`,
      html:     tmpReset(getTemplateData('reset-success', lang, {
        type: 'admin',
        url:  `http://${config.host}/login?lang=${lang}`,
      })),
    })
    .then( _ => deferred.resolve(updatedUser) )
    .catch(deferred.reject)
  }

  return deferred
}

UserSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compareSync(password, this.password)
}

//////
// DEFINING mailing groups
//////

tmpl.load = function (id) {
  var filename = path.join( __dirname, `/../views/${id}.html`)
  return fs.readFileSync(filename, 'utf8')
}

// put in cache
const tmpReset = tmpl( 'reset-password' )

function getTemplateData(templateName, lang, additionalDatas) {
  const i18n = {
    'reset-password': {
      fr: {
        title: `Bienvenue sur l'email builder de ${ brand.name }`,
        desc: `Cliquez sur le bouton ci-dessous pour initialiser votre mot de passe, ou copiez l'url suivante dans votre navigateur:`,
        reset: `INITIALISER MON MOT DE PASSE`,

      },
      en: {
        title: `Welcome to the  ${ brand.name }'s email builder`,
        desc: `Click the button below to reset your password, or copy the following URL into your browser:`,
        reset: `RESET MY PASSWORD`,
      }
    },
    'reset-success': {
      fr: {
        title: `Votre mot de passe a bien été réinitialisé`,
        desc: `Cliquez sur le bouton ci-dessous pour vous connecter, ou copiez l'url suivante dans votre navigateur:`,
        reset: `SE CONNECTER`,

      },
      en: {
        title: `Your password has been succesfully setted`,
        desc: `Click the button below to login, or copy the following URL into your browser:`,
        reset: `LOGIN`,
      }
    }
  }

  const t         = i18n[templateName][lang]
  const branding  = {
    name: brand.name,
    primary: brand['color-primary'],
    primaryContrast: brand['color-primary-contrast'],
  }

  return assign( {}, { t, branding }, additionalDatas )
}

//////
// EXPORTS
//////

module.exports = UserSchema
