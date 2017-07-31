'use strict'

const Sequelize       = require( 'sequelize' )

const sequelize       = require( './db-connection' )
const h               = require( '../helpers' )

const Tag             = sequelize.define( 'tag', {
  id:  {
    type:         Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey:   true,
  },
  name: {
    type:         Sequelize.STRING,
    set:          function ( val ) {
      this.setDataValue( 'name', h.normalizeString(val) )
    },
  },
})

module.exports = Tag
