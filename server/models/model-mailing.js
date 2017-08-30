'use strict'

const Sequelize   = require( 'sequelize' )
const { inspect } = require( 'util' )

const h           = require( '../helpers' )
const sequelize   = require( './db-connection' )

function templateLoadingUrl(templateId) {
  return `/templates/${templateId}/markup`
}

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

const Mailing =   sequelize.define( 'mailing', {
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
  data: {
    type:         Sequelize.JSON,
    defaultValue: {},
  },
  // VIRTUALS
  templateUrl: {
    type: new Sequelize.VIRTUAL(Sequelize.STRING, ['templateId']),
    get:  function () {
      return templateLoadingUrl( this.get('templateId') )
    },
  },
  url: {
    type: new Sequelize.VIRTUAL(Sequelize.JSON, ['id', 'templateId']),
    get: function () {
      return mailingUrls( this.get('id'), this.get('templateId') )
    }
  },
  mosaico: {
    type: new Sequelize.VIRTUAL(Sequelize.JSON, ['id', 'templateId', 'name', 'data', 'template']),
    get: function () {
      const id              = this.get( 'id' )
      const templateId      = this.get( 'templateId' )
      const template        = this.get('template')
      var mosaicoEditorData = {
        meta: {
          id:           id,
          _template:    templateId,
          name:         this.get( 'name' ),
          template:     templateLoadingUrl( templateId ),
          url:          mailingUrls( id, templateId ),
          // safeguard for not erroring on Mailing.build() calls
          assets:       template ? template.assets : {},
        },
        data: this.get('data'),
      }
      return mosaicoEditorData
    }
  },
})

module.exports = Mailing
