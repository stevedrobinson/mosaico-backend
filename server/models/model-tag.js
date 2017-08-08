'use strict'

const Sequelize       = require( 'sequelize' )

const h               = require( '../helpers' )
const cleanTagName    = require( '../../shared/clean-tag-name' )

module.exports = sequelize => {
  const Tag = sequelize.define( 'tag', {
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
  return Tag
}
