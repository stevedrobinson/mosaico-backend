'use strict'

const { Schema }    = require('mongoose')
const { ObjectId }  = Schema.Types

const { normalizeString } = require('./utils')
const { GroupModel }      = require('./names')

const TemplateSchema = Schema({
  name: {
    type:       String,
    unique:     true,
    required:   [true, 'name is required'],
    set:        normalizeString,
  },
  description: {
    type:       String,
  },
  _group: {
    type:       ObjectId,
    ref:        GroupModel,
    required:   [true, 'group is required'],
  },
  markup: {
    type:       String,
  },
  // need to store as JSON because mongoDB won't accept keys containing dots
  //   =>  MongoError: The dotted field is not valid for storage
  //   { 'pouic.png': '589321ab2cd3855cddd2aaad-36f5bb441ae6a8c15288cedac8b54f35.png' }
  // won't work
  assets: {
    type:       String,
    get:        v => {
      try {
        return JSON.parse( v )
      }
      catch (e) {
        return {}
      }
    },
    set:        v => {
      return JSON.stringify( v )
    },
  },
}, { timestamps: true })

TemplateSchema.virtual('imgPath').get(function () {
  return `/img/${this._id}-`
})

TemplateSchema.virtual('hasMarkup').get(function () {
  return this.markup != null
})

TemplateSchema.virtual('imagesList').get( function () {
  const result = []
  for (let name in this.assets) {
    let url = `/img/${ this.assets[ name ] }`
    result.push({ name, url })
  }
  return result
} )

TemplateSchema.virtual('url').get(function () {
  const userId    = this._user && this._user._id ? this._user._id : this._user
  const userUrl   = this._user ? `/users/${userId}` : '/users'
  const groupId   = this._group && this._group._id ? this._group._id : this._group
  const groupUrl  = this._group ? `/groups/${groupId}` : '/groups'
  const imgCover  = this.assets['_full.png'] ? `/img/${this.assets['_full.png']}` : false
  // read should be `/groups/${this._group}/template/${this._id}`
  return {
    read:             `/users/${this._user}/template/${this._id}`,
    show:             `/templates/${this._id}`,
    create:           `/mailings?templateId=${this._id}&_method=POST`,
    backTo:           this._group ? groupUrl : userUrl,
    user:             userUrl,
    group:            groupUrl,
    delete:           `/templates/${this._id}/delete`,
    markup:           `/templates/${this._id}/markup`,
    generatePreviews: `/templates/${this._id}/generatePreviews`,
    renderMarkup:     `/templates/${this._id}/renderMarkup`,
    imgCover:         imgCover,
  }
})

module.exports = TemplateSchema
