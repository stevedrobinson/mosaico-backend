'use strict'

const util      = require( 'util' )
const chalk     = require( 'chalk' )

const Group     = require( './model-group' )
const User      = require( './model-user' )
const Template  = require( './model-template' )
const Mailing   = require( './model-mailing' )
const Tag       = require( './model-tag' )
const Gallery   = require( './model-gallery' )
const sequelize = require( './db-connection' )

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
    // mongo doens't provide field name out of the box
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

function isFromGroup(user, groupId) {
  if (!user) return false
  if (user.isAdmin) return true
  // mailings from admin doesn't gave a groupId
  if (!groupId) return false
  return user._group.toString() === groupId.toString()
}

// users can access only same group content
// admin everything
function addGroupFilter(user, filter) {
  if (user.isAdmin) return filter
  filter._group = user._group
  return filter
}

// Strict difference from above:
// Admin can't content with a group
function addStrictGroupFilter(user, filter) {
  const _group  = user.isAdmin ? { $exists: false } : user._group
  filter._group = _group
  return filter
}

//////
// RELATIONS
//////

User.belongsTo( Group )

Template.belongsTo( Group )
Template.gallery  = Template.hasMany( Gallery )

Mailing.belongsTo( Group )
Mailing.belongsTo( User )
Mailing.belongsTo( Template )
Mailing.tags      = Mailing.hasMany( Tag )
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
  // connectDB,
  formatErrors,
  isFromGroup,
  addGroupFilter,
  addStrictGroupFilter,
  // Models
  Group,
  User,
  Template,
  Mailing,
  Tag,
  Gallery,
  // Cacheimages,
}
