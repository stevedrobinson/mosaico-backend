'use strict'

const fs          = require( 'fs-extra' )
const Sequelize   = require( 'sequelize' )
const bcrypt      = require( 'bcryptjs' )
const randtoken   = require( 'rand-token' )
const path        = require( 'path' )
const moment      = require( 'moment' )
const tmpl        = require( 'blueimp-tmpl' )
const { assign }  = require( 'lodash' )

const h           = require( '../helpers' )
const config      = require( '../config' )
const mail        = require( '../mail' )
const sequelize   = require( './db-connection' )

const status = {
  'deactivated': {
    value:          'admin.users.status.value.deactivated',
    icon:           'airline_seat_individual_suite',
    actionMsg:      'admin.users.status.action-long.activate',
    actionMsgShort: 'admin.users.status.action-short.activate',
  },
  'to-be-initialized': {
    value:          'admin.users.status.value.to-be-initialized',
    icon:           'report_problem',
    actionMsg:      'admin.users.status.action-long.send',
    actionMsgShort: 'admin.users.status.action-short.send',
  },
  'mail-sent': {
    value:          'admin.users.status.value.password-mail-sent',
    icon:           'schedule',
    actionMsg:      'admin.users.status.action-long.resend',
    actionMsgShort: 'admin.users.status.action-short.resend',
  },
  'confirmed': {
    value:          'admin.users.status.value.confirmed',
    icon:           'check',
    actionMsg:      'admin.users.status.action-long.reset',
    actionMsgShort: 'admin.users.status.action-short.reset',
  },
}

const User     = sequelize.define( 'user', {
  id:  {
    type:         Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey:   true,
  },
  email: {
    type:         Sequelize.STRING,
    allowNull:    false,
    unique:       true,
    validate: {   isEmail: true },
    set:          function ( val ) {
      this.setDataValue('email', h.normalizeString(val) )
    },
  },
  name: {
    type:         Sequelize.STRING,
    allowNull:    true,
    unique:       true,
    set:          function ( val ) {
      this.setDataValue( 'name', h.normalizeString(val) )
    },
  },
  lang: {
    type:         Sequelize.CHAR(2),
    defaultValue: 'en',
  },
  // Session
  password: {
    type:         Sequelize.STRING,
    set:          function ( val ) {
      if (typeof password === 'val') {
        return this.setDataValue( 'password', null )
      }
      this.setDataValue( 'password', bcrypt.hashSync( val, 10) )
      this.setDataValue( 'token', null )
      this.setDataValue( 'tokenExpire', null )
    },
  },
  token: {
    type:         Sequelize.STRING,
  },
  tokenExpire: {
    type:         Sequelize.DATE,
  },
  isDeactivated: {
    type:         Sequelize.BOOLEAN,
  },
  // VIRTUALS
  status: {
    type: new Sequelize.VIRTUAL(Sequelize.JSON, ['isDeactivated', 'password', 'token']),
    get: function() {
      const currentStatus = this.get( 'isDeactivated' ) ? 'deactivated' :
        this.get( 'password' ) ? 'confirmed' :
        this.get( 'token' ) ? 'mail-sent' :
        'to-be-initialized'
      return status[ currentStatus ]
    }
  },
  fullname: {
    type: new Sequelize.VIRTUAL(Sequelize.STRING, ['name', 'email']),
    get: function() {
      const name  = this.get('name')
      const email = this.get('email')
      return name ? `${name} (${email})` : email
    }
  },
  safename: {
    type: new Sequelize.VIRTUAL(Sequelize.STRING, ['name']),
    get: function() {
      const name  = this.get('name')
      return name ? name : '-'
    }
  },
  isReseted: {
    type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN, ['password', 'token']),
    get: function() {
      if (this.get('password'))  return false
      if (this.get('token'))     return true
      return false
    }
  },
  // for better session handling
  isAdmin: {
    type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN),
    get: function() {
      return false
    }
  },
  url: {
    type: new Sequelize.VIRTUAL(Sequelize.JSON, ['id', 'groupId']),
    get: function() {
      const id    = this.get('id')
      const urls  = {
        show:       `/users/${id}`,
        delete:     `/users/${id}?_method=DELETE`,
        reset:      `/users/${id}/reset`,
        activate:   `/users/${id}/activate`,
        deactivate: `/users/${id}/deactivate`,
        group:      `/groups/${ this.get('groupId') }`,
      }
      return urls
    }
  },
})

//----- MODEL METHODS

User.findByIdAndUpdate = async function( id, params ) {
  // https://medium.com/@griffinmichl/async-await-with-ternary-operators-af19f374215
  const user = await ( id ? this.findById(id) : new User() )
  if !user return null
  return user.update( params )
}

//----- INSTANCE METHODS

User.prototype.activate = function () {
  this.setDataValue( 'isDeactivated', false )
  return this.save()
}

User.prototype.deactivate = function () {
  this.setDataValue( 'isDeactivated', true )
  this.setDataValue( 'password',      null )
  this.setDataValue( 'token',         null )
  return this.save()
}

User.prototype.resetPassword = async function ( type ) {
  this.setDataValue( 'password',    null )
  this.setDataValue( 'token',       randtoken.generate(30) )
  this.setDataValue( 'tokenExpire', moment().add(1, 'weeks') )

  const user        = await this.save()
  const lang        = user.get( 'lang' )
  const isEn        = lang === 'en'
  const subject     = isEn ? 'password reset' : 'réinitialisation de mot de passe'
  const text        = isEn ? `here is the link to enter your new password` :
    `voici le lien pour réinitialiser votre mot de passe`
  const mailOptions = {
    to:       user.email,
    subject:  `${ brand.name } – ${ subject }`,
    text:     `${ text } http://${ config.host }/password/${ user.token }`,
    html:     tmpReset(getTemplateData('reset-password', lang, {
      type: type,
      url:    `http://${config.host}/password/${user.token}?lang=${lang}`,
    })),
  }
  const mailStatus  = await mail.send( mailOptions )
  return user
}

User.prototype.setPassword = async function ( password ) {
  this.setDataValue( 'password',    password )
  this.setDataValue( 'token',       null )
  this.setDataValue( 'tokenExpire', null )

  const user        = await this.save()
  const lang        = user.get( 'lang' )
  const isEn        = lang === 'en'
  const subject     = isEn ? 'password reset' : 'réinitialisation de mot de passe'
  const text        = isEn ? `your password has been succesfully been reseted. connect at` :
    `Votre mot de passe à bien été réinitialisé. Connectez-vous à l'adresse suivante :`
  const mailOptions = {
    to:       user.email,
    subject:  `${ brand.name } – ${ subject }`,
    text:     `${ text } http://${config.host}/login`,
    html:     tmpReset(getTemplateData('reset-success', lang, {
      type: 'admin',
      url:  `http://${config.host}/login?lang=${lang}`,
    })),
  }
  const mailStatus  = await mail.send( mailOptions )
  return user
}

User.prototype.comparePassword = function (password) {
  return bcrypt.compareSync( password, this.getDataValue('password') )
}

//////
// DEFINING mailing groups
//////

const { brand } = config

tmpl.load       = function (id) {
  var filename = path.join( __dirname, `/../views/${id}.html` )
  return fs.readFileSync( filename, 'utf8' )
}

// put in cache
const tmpReset = tmpl( 'reset-password' )
const tmplI18n = {
  'reset-password': {
    fr: {
      title:  `Bienvenue sur l'email builder de ${ brand.name }`,
      desc:   `Cliquez sur le bouton ci-dessous pour initialiser votre mot de passe, ou copiez l'url suivante dans votre navigateur:`,
      reset:  `INITIALISER MON MOT DE PASSE`,

    },
    en: {
      title:  `Welcome to the  ${ brand.name }'s email builder`,
      desc:   `Click the button below to reset your password, or copy the following URL into your browser:`,
      reset:  `RESET MY PASSWORD`,
    }
  },
  'reset-success': {
    fr: {
      title:  `Votre mot de passe a bien été réinitialisé`,
      desc:   `Cliquez sur le bouton ci-dessous pour vous connecter, ou copiez l'url suivante dans votre navigateur:`,
      reset:  `SE CONNECTER`,

    },
    en: {
      title:  `Your password has been succesfully setted`,
      desc:   `Click the button below to login, or copy the following URL into your browser:`,
      reset:  `LOGIN`,
    }
  }
}

function getTemplateData(templateName, lang, additionalDatas) {
  const t         = tmplI18n[ templateName ][ lang ]
  const branding  = {
    name:             brand.name,
    primary:          brand['color-primary'],
    primaryContrast:  brand['color-primary-contrast'],
  }

  return assign( {}, { t, branding }, additionalDatas )
}

module.exports = User
