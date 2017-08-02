'use strict'

const util        = require( 'util' )
const chalk       = require( 'chalk' )

const sequelize   = require( './db-connection' )
const Group       = require( './model-group' )
const User        = require( './model-user' )
const Template    = require( './model-template' )
const Mailing     = require( './model-mailing' )
const Tag         = require( './model-tag' )
const Gallery     = require( './model-gallery' )
const ImageCache  = require( './model-image-cache' )

//////
// ERRORS HANDLING
//////

// normalize errors between mongoose & mongoDB
function handleValidationErrors(err) {
  console.log('handleValidationErrors')
  console.log(util.inspect(err))
  // mongoose errors
  if (err.name === 'ValidationError') {
    return Promise.resolve(err.errors)
  }
  // duplicated field
  if (err.name === 'MongoError' && err.code === 11000) {
    // mongo doesn't provide field name out of the box
    // fix that based on the error message
    var fieldName = /index:\s([a-z]*)/.exec(err.message)[1]
    var errorMsg  = {}
    errorMsg[fieldName] = {
      message: `this ${fieldName} is already taken`,
    }
    return Promise.resolve(errorMsg)
  }
  return Promise.reject(err)
}

// take care of everything
function formatErrors(err, req, res, next) {
  handleValidationErrors(err)
  .then( errorMessages => {
    req.flash('error', errorMessages)
    res.redirect(req.path)
  })
  .catch(next)
}

//////
// HELPERS
//////

// users can access only same group content
// admin everything
function addGroupFilter(req, dbQueryParams) {
  const { user }        = req
  const { isAdmin }     = user
  if ( !isAdmin ) dbQueryParams.where.groupId = user.groupId
  return dbQueryParams
}

// Strict difference from above:
// Admin can only see content without a group (so created by him)
function addStrictGroupFilter(req, dbQueryParams) {
  const { user }        = req
  const { isAdmin }     = user
  dbQueryParams.where.groupId = isAdmin ? { $eq: null } : user.groupId
  return dbQueryParams
}

//////
// RELATIONS
//////

User.belongsTo( Group )
User.mailings     = User.hasMany( Mailing )

Template.belongsTo( Group )
Template.gallery  = Template.hasMany( Gallery )
Template.mailings = Template.hasMany( Mailing )

Mailing.belongsTo( Group )
Mailing.belongsTo( User )
Mailing.belongsTo( Template )
Mailing.tags      = Mailing.belongsToMany( Tag, {through: 'MailingTag'} )
Mailing.gallery   = Mailing.hasMany( Gallery )

Tag.belongsTo( Group )
Tag.belongsToMany( Mailing, {through: 'MailingTag'})

Group.users       = Group.hasMany( User )
Group.templates   = Group.hasMany( Template )
Group.mailings    = Group.hasMany( Mailing )
Group.tags        = Group.hasMany( Tag )

Gallery.belongsTo( Mailing )
Gallery.belongsTo( Template )

//////
// EXPORTS
//////

module.exports    = {
  sequelize,
  // utilities,
  formatErrors,
  addGroupFilter,
  addStrictGroupFilter,
  // Models
  Group,
  User,
  Template,
  Mailing,
  Tag,
  Gallery,
  ImageCache,
}
