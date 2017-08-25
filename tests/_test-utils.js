'use strict'

process.env.TEST  = true

const {
  promisify,
  inspect }         = require( 'util' )
const Nightmare     = require( 'nightmare' )
const realMouse     = require( 'nightmare-real-mouse' )
const child_process = require( 'child_process' )
const exec          = promisify( child_process.exec )
const path          = require( 'path' )
const c             = require( 'chalk' )
const clearRequire  = require( 'clear-require' )
const importFresh = require('import-fresh')

const { defer }     = require( '../server/helpers' )
const config        = require( '../server/config')
const testDatas     = path.join( __dirname, './sql-test.sqlc' )

const dbTest        = `postgres://localhost:5432/mosaico-backend-test`

// found that it is less prone to errors
realMouse( Nightmare )

////////
// SHARED FUNCTIONNAL THINGS
////////

async function setupDB() {
  const command = `pg_restore --clean --if-exists --dbname=${dbTest} ${testDatas}`
  await exec( command )
  console.log( c.blue('[TEST]'), `DB setup has been done` )
}

async function setup(show = false)  {
  const nightmare = Nightmare({
    show,
    waitTimeout: 5000,
  }).viewport(1280, 780)
  const db        = await setupDB()

  // because tests will do many require('../server')() and then server.shutdown()
  // connection will be disabled. Then if a model cached by nodes do any action on DB it will have this error
  // >>  ConnectionManager.getConnection was called after the connection manager was closed
  // so:
  // clean the cache!
  // https://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
  // console.log(  inspect(Object.keys(require.cache).filter( k => !/node_modules/.test(k) )))

  // console.log(  inspect(Object.keys(require.cache).filter( k => /\/sequelize\/lib/.test(k) )))
  clearRequire.match( /\/server\// )

  clearRequire.match( /node_modules\/sequelize\/lib/ )
  clearRequire.match( /node_modules\/bluebird/ )
  // console.log(  inspect(Object.keys(require.cache).filter( k => /\/sequelize\/lib/.test(k) )))

  // console.log(  inspect(Object.keys(require.cache).filter( k => /\/server\//.test(k) )))
  // clearRequire.all()
  // get the server instance so we can stop it at the end of a test
  // const createServer  = importFresh( '../server')
  const createServer  = require( '../server')
  const server        = await createServer()

  const closeNightmare = () => {
    const dfd = defer()
    nightmare.halt()
    server.shutdown()
    server.on('shutdown', dfd.resolve )
  }

  return { nightmare, closeNightmare }

}

const createTest = (plan, showNightmare = false, cb) => async t => {
  t.plan( plan )
  const { nightmare, closeNightmare } = await setup( showNightmare )
  try {
    await cb(t, nightmare, closeNightmare)
  } catch(err) {
    await closeNightmare()
    t.end(err)
  }
}

// example:

// test( T1, createTest( 1, false, async (t, nm, close) => {
//
//   await close()
//
// }))


function connectUser(email = 'p@p.com', password = 'p' ) {
  return nightmare => {
    return nightmare
    .goto( `http://${ config.host }?lang=en` )
    .wait( 2000 )
    .insert( '#email-field', email )
    .wait( 2000 )
    .insert( '#password-field', password )
    .wait( 2000 )
    .realClick( 'form[action*="/login"] [type=submit]' )
    .wait( 2000 )
    .wait( '.js-filter' )
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
// EXPORTS
////////

module.exports = {
  connectUser,
  connectAdmin,
  createTest,
}
