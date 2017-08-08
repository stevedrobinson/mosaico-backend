'use strict'

const Sequelize   = require( 'sequelize' )

const h           = require( '../helpers' )

module.exports = sequelize => {
  const Group     = sequelize.define( 'group', {
    id: {
      type:         Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey:   true,
    },
    name: {
      type:         Sequelize.STRING,
      allowNull:    false,
      validate:     {
        notEmpty: true,
      },
      unique:       true,
      set:          function (val) {
        this.setDataValue('name', h.normalizeString( val ) )
      }
    },
    // VIRTUALS
    url: {
      type: new Sequelize.VIRTUAL(Sequelize.JSON, ['id']),
      get: function() {
        const id    = this.get('id')
        const urls  = {
          show:         `/groups/${id}`,
          delete:       `/groups/${id}/delete`,
          newUser:      `/groups/${id}/new-user`,
          newTemplate:  `/groups/${id}/new-template`,
        }
        return urls
      }
    },
  })

  // Don't use upsert as it didn't return an instance but only a status
  // http://docs.sequelizejs.com/class/lib/model.js~Model.html#static-method-upsert
  Group.updateOrCreate = async function( id, params ) {
    // https://medium.com/@griffinmichl/async-await-with-ternary-operators-af19f374215
    const group = await ( id ? this.findById(id) : new Group() )
    if ( !id & !group ) return null
    return group.update( params )
  }

  return Group
}
