'use strict'

const util        = require( 'util' )
const chalk       = require( 'chalk' )

//////
// HELPERS
//////

// users can access only same group content
// admin everything
function addGroupFilter(req, dbQueryParams = {}) {
  const { user }        = req
  const { isAdmin }     = user
  dbQueryParams.where   = dbQueryParams.where || {}
  if ( !isAdmin ) dbQueryParams.where.groupId = user.groupId
  return dbQueryParams
}

// Strict difference from above:
// Admin can only see content without a group (so created by him)
function addStrictGroupFilter(req, dbQueryParams = {}) {
  const { user }        = req
  const { isAdmin }     = user
  dbQueryParams.where   = dbQueryParams.where || {}
  dbQueryParams.where.groupId = isAdmin ? { $eq: null } : user.groupId
  return dbQueryParams
}

function init( sequelize ) {

  const Group       = require( './model-group' )( sequelize )
  const User        = require( './model-user' )( sequelize )
  const Template    = require( './model-template' )( sequelize )
  const Mailing     = require( './model-mailing' )( sequelize )
  const Tag         = require( './model-tag' )( sequelize )
  const Gallery     = require( './model-gallery' )( sequelize )
  const ImageCache  = require( './model-image-cache' )( sequelize )

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

  return {
    Group,
    User,
    Template,
    Mailing,
    Tag,
    Gallery,
    ImageCache,
  }
}

//////
// EXPORTS
//////

module.exports    = {
  // helpers
  addGroupFilter,
  addStrictGroupFilter,
  // Models
  init,
}
