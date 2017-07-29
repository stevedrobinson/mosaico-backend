'use strict'

const Sequelize = require( 'sequelize' )

const config    = require( '../config' )

let logging     = () => {}

if ( config.log.db ) {
  const formattor = require( 'formattor' )
  logging = query => console.log( formattor(query, {method: 'sql'}) )
}

module.exports = new Sequelize( config.database, {
  logging,
})
