'use strict'

const { Schema, Types } = require('mongoose')
const { ObjectId }      = Schema.Types

const { normalizeString } = require('./utils')
const { UserModel, TemplateModel, GroupModel } = require('./names')

const MailingSchema  = Schema({
  name: {
    type:     String,
    set:      normalizeString,
    required: true,
  },
  // _user can't be required: admin doesn't set a _user
  _user: {
    type:     ObjectId,
    ref:      UserModel,
  },
  // replicate user name for ordering purpose
  author: {
    type:     String,
    set:      normalizeString,
  },
  _template: {
    type:     ObjectId,
    required: true,
    ref:      TemplateModel,
  },
  // replicate template name for ordering purpose
  templateName: {
    type:       String,
    set:        normalizeString,
  },
  // _group can't be required: admin doesn't have a _group
  _group: {
    type:     ObjectId,
    ref:      GroupModel,
  },
  tags: {
    type:     [],
  },
  // http://mongoosejs.com/docs/schematypes.html#mixed
  data: { },

}, { timestamps: true })

MailingSchema.virtual('key').get(function () {
  return this._id
})

function templateLoadingUrl(templateId) {
  return `/templates/${templateId}/markup`
}

// path to load a template
MailingSchema.virtual('template').get(function () {
  return templateLoadingUrl( this._template )
})

MailingSchema.virtual('created').get(function () {
  return this.createdAt.getTime()
})

MailingSchema.virtual('changed').get(function () {
  return this.updatedAt.getTime()
})

function mailingUrls(mailingId, templateId) {
  return {
    update:     `/mailings/${mailingId}`,
    duplicate:  `/mailings/${mailingId}/duplicate`,
    delete:     `/mailings/${mailingId}?_method=DELETE`,
    send:       `/mailings/${mailingId}/send`,
    zip:        `/mailings/${mailingId}/zip`,
    transfer:   `/mailings/${mailingId}/transfer`,
    template:   `/templates/${templateId}`,
  }
}

MailingSchema.virtual('url').get(function () {
  return mailingUrls(this._id, this._template)
})

// _template must be populated
MailingSchema.virtual('mosaico').get(function () {
  var templateId       = this._template._id
  var mosaicoEditorData = {
    meta: {
      id:           this._id,
      _template:    templateId,
      name:         this.name,
      template:     templateLoadingUrl( templateId ),
      url:          mailingUrls( this._id, templateId ),
      assets:       this._template.assets,
    },
    data: this.data,
  }
  return mosaicoEditorData
})

// http://stackoverflow.com/questions/18324843/easiest-way-to-copy-clone-a-mongoose-document-instance#answer-25845569
MailingSchema.methods.duplicate = function duplicate(_user) {
  var oldId       = this._id.toString()
  var newId       = Types.ObjectId()
  this._id        = newId
  this.name       = `${this.name.trim()} copy`
  this.isNew      = true
  this.createdAt  = new Date()
  this.updatedAt  = new Date()
  // set new user
  if (_user.id) {
    this._user  = _user._id
    this.author = _user.name
  }
  // update all groups infos
  if (this.data) {
    var data    = JSON.stringify(this.data)
    var replace = new RegExp(oldId, 'gm')
    data        = data.replace(replace, newId.toString())
    this.data   = JSON.parse(data)
    this.markModified('data')
  }

  return this
}

module.exports = MailingSchema
