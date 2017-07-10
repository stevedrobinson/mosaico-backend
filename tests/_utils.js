'use strict'

process.env.TEST  = true

const Nightmare   = require( 'nightmare' )
const exec        = require( 'child_process' ).exec
const path        = require( 'path' )
const c           = require( 'chalk' )
const args        = require( 'yargs' ).argv
const fs          = require( 'fs-extra' )

const defer         = require('../server/helpers/create-promise')
const config        = require('../server/config')
const tmpFolder     = config.images.tmpDir
const dumpFolder    = `${tmpFolder}/local-db-before-test-snapshot`
const u             = require('../bin/_db-utils')
const dbLocal       = config.dbConfigs.local
const tableName     = dbLocal.folder
const testDatas     = path.join(__dirname, './test-datas')
const createServer  = require('../server')

// can be usefull in some edge case
// https://github.com/Mr0grog/nightmare-real-mouse

////////
// SHARED FUNCTIONNAL THINGS
////////

function createWindow(show = false) {
  return Nightmare({ show })
  .viewport(1280, 780)
}

function connectUser(email = 'p@p.com', password = 'p' ) {
  return nightmare => {
    return nightmare
    .goto( `http://${ config.host }?lang=en` )
    .insert('#email-field', email)
    .insert('#password-field', password)
    .click('form[action*="/login"] [type=submit]')
    .wait(10)
    .wait('.mailing-list')
  }
}

function connectAdmin() {
  return nightmare => {
    return nightmare
    .goto( `http://${ config.host }/admin?lang=en` )
    .insert('#password-field', 'admin')
    .click('form[action*="/login"] [type=submit]')
    .wait(10)
    .wait('.js-admin-home')
  }
}

////////
// DB
////////

//----- SETUP

function setupDB() {
  const dfd     = defer()
  const copyCmd = `mongorestore --drop ${u.setDbParams(dbLocal)} ${testDatas}`
  exec( copyCmd, (error, stdout, stderr) => {
    if (error !== null) return dfd.reject( error )
    dfd.resolve()
  })

  return dfd
}

function setupServer() {
  // always run the test server with a clean test db
  return setupDB()
  .then( createServer )
  .catch( err => { throw err })
}

//----- TEARDOWN

// while using tape t.plan,
// - calling the last test will end the current test
// - next test will be called
// - BUT we need to wait the server to be shutted
// - AND we need to wait NIGHTMARE to close
// https://github.com/segmentio/nightmare/issues/546

function teardownDBAndNightmare(t, nightmare, server) {
  return function (tapeFinalTest) {
    return function nightmarePromiseCallback(result) {
      nightmare.halt()
      server.shutdown()
      server.on('shutdown', () => tapeFinalTest(result) )
    }
  }
}

function teardownAndError(t, nightmare, server) {
  return function(testError) {
    nightmare.halt()
    server.shutdown()
    server.on('shutdown', () => t.end(testError) )
  }
}

function getTeardownHandlers(t, nightmare, server) {
  return {
    onEnd:    teardownDBAndNightmare(t, nightmare, server),
    onError:  teardownAndError(t, nightmare, server),
  }
}

////////
// EXPORTS
////////

module.exports = {
  createWindow,
  connectUser,
  connectAdmin,
  getTeardownHandlers,
  setupServer,
}
