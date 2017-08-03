'use strict'

const Sequelize       = require( 'sequelize' )

const sequelize       = require( './db-connection' )
const h               = require( '../helpers' )
const cleanTagName    = require( '../../shared/clean-tag-name' )

const Tag             = sequelize.define( 'tag', {
  id:  {
    type:         Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey:   true,
  },
  name: {
    type:         Sequelize.STRING,
    set:          function ( val ) {
      val = cleanTagName( h.normalizeString(val) )
      this.setDataValue( 'name', val )
    },
    validate:     {
      is:         /[^",']+/,
      notEmpty:   true,
    },
  },
})

module.exports = Tag
