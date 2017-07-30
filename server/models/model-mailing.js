'use strict'

const Sequelize       = require( 'sequelize' )
const { inspect }     = require( 'util' )

const sequelize       = require( './db-connection' )
const h               = require( '../helpers' )

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

const Mailing        = sequelize.define( 'mailing', {
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
  // TODO check if used
  // key: {
  //   type: new Sequelize.VIRTUAL(Sequelize.STRING, ['id']),
  //   get:  function () {
  //     return this.get( 'id' )
  //   },
  // },
  templateUrl: {
    type: new Sequelize.VIRTUAL(Sequelize.STRING, ['templateId']),
    get:  function () {
      return templateLoadingUrl( this.get('templateId') )
    },
  },
  created: {
    type: new Sequelize.VIRTUAL(Sequelize.INTEGER, ['createdAt']),
    get:  function () {
      return this.get('createdAt').getTime()
    },
  },
  changed: {
    type: new Sequelize.VIRTUAL(Sequelize.INTEGER, ['updatedAt']),
    get:  function () {
      return this.get('updatedAt').getTime()
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
      var mosaicoEditorData = {
        meta: {
          id:           id,
          _template:    templateId,
          name:         this.get( 'name' ),
          template:     templateLoadingUrl( templateId ),
          url:          mailingUrls( id, templateId ),
          assets:       this.get('template').assets,
        },
        data: this.get('data'),
      }
      return mosaicoEditorData
    }
  },
})

// http://stackoverflow.com/questions/18324843/easiest-way-to-copy-clone-a-mongoose-document-instance#answer-25845569
Mailing.prototype.duplicate = async function() {
  console.log( this.toJSON() )
  return this
}
// MailingSchema.methods.duplicate = function duplicate(_user) {
//   var oldId       = this._id.toString()
//   var newId       = Types.ObjectId()
//   this._id        = newId
//   this.name       = `${this.name.trim()} copy`
//   this.isNew      = true
//   this.createdAt  = new Date()
//   this.updatedAt  = new Date()
//   // set new user
//   if (_user.id) {
//     this._user  = _user._id
//     this.author = _user.name
//   }
//   // update all groups infos
//   if (this.data) {
//     var data    = JSON.stringify(this.data)
//     var replace = new RegExp(oldId, 'gm')
//     data        = data.replace(replace, newId.toString())
//     this.data   = JSON.parse(data)
//     this.markModified('data')
//   }

//   return this
// }

module.exports = Mailing
