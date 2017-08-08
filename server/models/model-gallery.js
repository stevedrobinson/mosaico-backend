'use strict'

const Sequelize   = require( 'sequelize' )

const h           = require( '../helpers' )

module.exports = sequelize => {
  const Gallery = sequelize.define( 'gallery', {
    name: {
      type:         Sequelize.STRING,
      primaryKey:   true,
    },
    // VIRTUALS
    url: {
      type: new Sequelize.VIRTUAL(Sequelize.STRING, ['name']),
      get: function() { return `/img/${ this.get('name') }` },
    },
    deleteUrl: {
      type: new Sequelize.VIRTUAL(Sequelize.STRING, ['name', 'mailingId']),
      get: function() {
        // const galleryType = this.get('mailingId') ? 'mailing' : 'template'
        // return `/img/${ galleryType }/${ this.get('name') }`
        return `/img/${ this.get('name') }`
      },
    },
    thumbnailUrl: {
      type: new Sequelize.VIRTUAL(Sequelize.STRING, ['name']),
      get: function() { return `/cover/111x111/${ this.get('name') }` },
    },
  })

  return Gallery
}

