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

//////
// MODELS
//////

const Group       = require( './model-group' )
const User        = require( './model-user' )
const Template    = require( './model-template' )
const Mailing     = require( './model-mailing' )
const Tag         = require( './model-tag' )
const Gallery     = require( './model-gallery' )
const ImageCache  = require( './model-image-cache' )

//----- RELATIONS

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
  // helpers
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
