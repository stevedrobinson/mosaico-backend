'use strict'

const util      = require( 'util' )
const chalk     = require( 'chalk' )
// const mongoose  = require('mongoose')

const Group     = require( './model-group' )
const User      = require( './model-user' )
const Template  = require( './model-template' )
const sequelize = require( './db-connection' )

// mongoose.Promise    = global.Promise // Use native promises
// let connection

// const UserSchema        = require('./schema-user')
// const TemplateSchema    = require('./schema-template')
// const MailingSchema     = require('./schema-mailing')
// const GroupSchema       = require('./schema-group')
// const CacheimageSchema  = require('./schema-cache-image')
// const GallerySchema     = require('./schema-gallery')
// const {
//   UserModel,
//   TemplateModel,
//   MailingModel,
//   GroupModel,
//   CacheimageModel,
//   GalleryModel,
// } = require('./names')

// mongoose.connection.on('error', console.error.bind(console, chalk.red('[DB] connection error:')))
// mongoose.connection.once('open', e =>  {
//   console.log(chalk.green('[DB] connection OK'))
// })

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

// function connectDB(dbConfig) {
//   // remove depreciation warning
//   // http://mongoosejs.com/docs/connections.html#use-mongo-client
//   connection    = mongoose.connect(dbConfig, { useMongoClient: true, })
//   return connection
// }

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

Group.users     = Group.hasMany( User )
Group.templates = Group.hasMany( Template )

User.belongsTo( Group )

Template.belongsTo( Group )

//////
// EXPORTS
//////

// const User       = mongoose.model( UserModel, UserSchema )
// const Templates   = mongoose.model( TemplateModel, TemplateSchema )
// const Mailings    = mongoose.model( MailingModel, MailingSchema )
// const Group      = mongoose.model( GroupModel, GroupSchema )
// const Cacheimages = mongoose.model( CacheimageModel, CacheimageSchema )
// const Galleries   = mongoose.model( GalleryModel, GallerySchema )

module.exports    = {
  sequelize,
  // connectDB,
  formatErrors,
  isFromGroup,
  addGroupFilter,
  addStrictGroupFilter,
  // Compiled schema
  Group,
  User,
  Template,
  // Mailings,
  // Cacheimages,
  // Galleries,
}
