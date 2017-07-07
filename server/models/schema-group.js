'use strict'

const { Schema }    = require('mongoose')

const { normalizeString } = require('./utils')

const GroupSchema = Schema({
  name: {
    type:     String,
    required: [true, 'A name is required'],
    // http://mongoosejs.com/docs/api.html#schematype_SchemaType-unique
    // from mongoose doc:
    // violating the constraint returns an E11000 error from MongoDB when saving, not a Mongoose validation error.
    unique:   true,
    set:      normalizeString,
  },
}, { timestamps: true })

GroupSchema.virtual('url').get(function () {
  return {
    show:         `/groups/${this._id}`,
    delete:       `/groups/${this._id}/delete`,
    newUser:      `/groups/${this._id}/new-user`,
    newTemplate: `/groups/${this._id}/new-template`,
  }
})

module.exports = GroupSchema
