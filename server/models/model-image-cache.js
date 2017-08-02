'use strict'

const Sequelize = require( 'sequelize' )

const sequelize = require( './db-connection' )
const h         = require( '../helpers' )

const ImageCache  = sequelize.define( 'imageCache', {
  path: {
    type:         Sequelize.STRING,
    allowNull:    false,
    primaryKey:   true,
    set:          function (val) {
      this.setDataValue('path', h.normalizeString( val ) )
    },
  },
  name: {
    type:         Sequelize.STRING,
    allowNull:    false,
    unique:       true,
    set:          function (val) {
      this.setDataValue('name', h.normalizeString( val ) )
    }
  },
}, {
  // don't add the timestamp attributes (updatedAt, createdAt)
  timestamps: false,
})

module.exports = ImageCache
