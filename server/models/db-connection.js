'use strict'

const Sequelize = require('sequelize')

const config = require('../config')

let logging = () => {}
const { Op } = Sequelize

if (config.log.db) {
  const formattor = require('formattor')
  logging = query => console.log(formattor(query, { method: 'sql' }))
}

// Aliases all operators to the equivalent Symbols
// see comment on the new connection
const operatorsAliases = {}
Object.entries(Op).forEach(([key, value]) => {
  operatorsAliases[`$${key}`] = value
})

module.exports = new Sequelize(config.database, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: true
    },
    logging,
  // remove sequelize deprecation warnings
  // https://github.com/sequelize/sequelize/issues/8417#issuecomment-341617577
  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators-security
  operatorsAliases,
})
