'use strict'

process.env.TEST  = true

const { inspect }   = require( 'util' )
const Nightmare     = require( 'nightmare' )
const realMouse     = require( 'nightmare-real-mouse' )
const child_process = require( 'child_process' )
const { exec }      = child_process
const path          = require( 'path' )
const c             = require( 'chalk' )
const clearRequire  = require( 'clear-require' )

const { defer }     = require( '../server/helpers' )
const config        = require( '../server/config')
const testDatas     = path.join( __dirname, './sql-test.sqlc' )

const dbTest        = `postgres://localhost:5432/mosaico-backend-test`

// found that it is less prone to errors
realMouse( Nightmare )

////////
// SHARED FUNCTIONNAL THINGS
////////

const resetDB = async _ => {
  const dfd = defer()
  const command = `pg_restore --clean --dbname=${dbTest} ${testDatas}`
  const result  = exec( command, (err, stdout, stderr) => {
    if ( err ) {
      console.error(`exec error: ${err}`)
      return dfd.reject()
    }
    if ( stderr ) {
      console.error(`stderr error`)
      console.log(stderr)
      return dfd.reject()
    }
    console.log( c.blue('[TEST]'), `DB setup has been done` )
    dfd.resolve()
  })
  return dfd
}

const testEnv = _ => {

  let server, nightmare

  const start = async _ => {
    // reset all server cache:
    //   mainly because of DB connection from sequelize
    clearRequire.match( /\/server\// )
    // clean also passport:
    //   he will retain an old DB connection in deserialize user :(
    clearRequire.match( /\/passport\// )
    await resetDB()
    const app = await require( '../server')()
    server    = app
  }

  const stop = _ => {
    const dfd = defer()
    if (server && server.shutdown) {
      server.on( 'shutdown', dfd.resolve )
      server.shutdown()
    }
    return dfd
  }

  return { start, stop }

}

// tape callback wrapper
// we could have wrapped the whole tape function but we would have lost:
//  - test.skip
//  - test.only
const createTest = (showNightmare = true, cb) => async t => {
  const { start, stop } = testEnv( showNightmare )
  let nm

  try {
    await start()
    // for a strange reason I can't put nightmare in start
    // if done, return value is `undefined` ¬_¬'
    nm = Nightmare({ show: showNightmare, waitTimeout: 10000}).viewport(1280, 780)
    await cb(t, nm)
    await stop()
    if (nm && nm.halt) nm.halt()
    t.end()
  } catch(err) {
    await stop()
    if (nm && nm.halt) nm.halt()
    t.end(err)
  }
}

////////
// NIGHTMARE COMMON ROUTINES & DATAS
////////

const data = {
  ACTIVE_USER_NAME:   'paul – active user',
  ACTIVE_USER_EMAIL:  'p@p.com',
  ACTIVE_USER_PASS:   'p',
  ACTIVE_USER_ID:     'f30e44d8-7a54-41c9-8814-113a90e02f6e',
  UNACTIVE_USER_ID:   '98540149-8bac-4576-b03c-a06e66196b02',
  NEW_USER_ID:        'e1d8af49-63c2-4638-a288-7e9461b516da',
  TEMPLATE_ID:        'b109c93c-679e-4a7c-8f84-9de3a13c1b38',
  VERSAFIX_ID:        '7131811e-4a5b-4f5b-abd4-eef319b920b1',
  VERSAFIX_NAME:      'versafix',
  GROUP_ID:           'c40dce03-7549-49f3-968a-8c77a7177425',
  ADMIN_MAILING_ID:   '4fe4a47a-2d78-4561-8912-3832f41de389',
}

const connectUser = (email = data.ACTIVE_USER_EMAIL, password = data.ACTIVE_USER_PASS ) => {
  return nightmare => {
    return nightmare
    .goto( `http://${ config.host }?lang=en` )
    .insert( '#email-field', email )
    .insert( '#password-field', password )
    .realClick( 'form[action*="/login"] [type=submit]' )
    .wait( '.js-filter' )
  }
}

const connectAdmin = _ => nightmare => {
  return nightmare
  .goto( `http://${ config.host }/admin?lang=en` )
  .insert('#password-field', 'admin')
  .realClick('form[action*="/login"] [type=submit]')
  .wait('.js-admin-home')
}

////////
// EXPORTS
////////

module.exports = {
  createTest,
  // nightmare common routines & datas
  data,
  connectUser,
  connectAdmin,
}
