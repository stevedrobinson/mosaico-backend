'use strict'

const Sequelize       = require( 'sequelize' )

const sequelize       = require( './db-connection' )
const h               = require( '../helpers' )

const Template        = sequelize.define( 'template', {
  id:  {
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
    set:          function ( val ) {
      this.setDataValue( 'name', h.normalizeString(val) )
    },
  },
  markup: {
    type:         Sequelize.TEXT,
    set:          function ( val ) {
      val = Buffer.isBuffer( val ) ? val.toString( 'utf8' ) : val
      this.setDataValue( 'markup', val )
    },
  },
  assets: {
    type:         Sequelize.JSON,
    defaultValue: {},
  },
  // VIRTUALS
  imgPath: {
    type: new Sequelize.VIRTUAL(Sequelize.STRING, ['id']),
    get:  function () {
      return `/img/${ this.get( 'id' ) }-`
    },
  },
  hasMarkup: {
    type: new Sequelize.VIRTUAL(Sequelize.BOOLEAN, ['markup']),
    get: function () {
      return this.get( 'markup' ) != null
    },
  },
  imagesList: {
    type: new Sequelize.VIRTUAL(Sequelize.ARRAY, ['assets']),
    get: function () {
      const result  = []
      const assets  = this.get( 'assets' )
      for (let name in assets) {
        let url = `/img/${ assets[ name ] }`
        result.push({ name, url })
      }
      return result
    },
  },
  url: {
    type: new Sequelize.VIRTUAL(Sequelize.JSON, ['id', 'groupId', 'assets']),
    get: function () {
      const id        = this.get( 'id' )
      const groupId   = this.get( 'groupId' )
      const assets    = this.get( 'assets' )
      const userUrl   = id ? `/users/${ id }` : '/users'
      const groupUrl  = groupId ? `/groups/${groupId}` : '/groups'
      const imgCover  = assets['_full.png'] ? `/img/${assets['_full.png']}` : false
      const urls  = {
        show:             `/templates/${id}`,
        create:           `/mailings?templateId=${id}&_method=POST`,
        backTo:           groupId ? groupUrl : userUrl,
        user:             userUrl,
        group:            groupUrl,
        delete:           `/templates/${ id }?_method=DELETE`,
        markup:           `/templates/${ id }/markup`,
        generatePreviews: `/templates/${ id }/generate-previews`,
        renderMarkup:     `/templates/${ id }/render-markup`,
        imgCover:         imgCover,
      }
      return urls
    }
  },
})

module.exports = Template
