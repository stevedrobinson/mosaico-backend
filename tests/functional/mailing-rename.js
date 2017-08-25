'use strict'

const test      = require('tape')
const {
  connectUser,
  connectAdmin,
  setupServer,
  resetDB,
  createTest, } = require('../_test-utils')
const { serverReady, stopServer } = setupServer()
test.onFinish( async _ => await stopServer() )

const data      = {
  MAILING_ID:     '88e776cb-8062-4933-9589-6c24e1ec8e8c'
}
const rename          = {
  nameSelector:   `#toolbar > div.mailing-name > p > span`,
  inputSelector:  `#toolbar > form > input[type="text"]`,
  submitSelector: `#toolbar > form > button[type="submit"]`,
}

function gotToEditor(nm) {
  return nm
  .goto( `http://localhost:8000/mailings/${ data.MAILING_ID }`  )
  .wait( '#toolbar .mailing-name' )
  .realClick( '#toolbar > div.mailing-name > p' )
  .wait( 10 )
  .realClick( '#toolbar > div.mailing-name > p' )
  .wait( '#toolbar > form > input[type="text"]' )
  .insert( '#toolbar > form > input[type="text"]' , false)
}

function checkName(nm) {
  return nm
  .realClick( rename.submitSelector )
  .wait( rename.nameSelector )
  .evaluate( nameSelector => {
    const name  = document.querySelector( nameSelector ).textContent
    return { name }
  }, rename.nameSelector)
  .end()
}

//////
// EDITOR
//////

const T1 = 'rename from editor – can rename'
test( T1, createTest( 1, false, async (t, nm, close) => {
  await Promise.all( [serverReady, resetDB()] )

  const renameTestMailingTitle = 'new mailing name'
  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .insert( rename.inputSelector, renameTestMailingTitle )
    .use( checkName )

  await close()

  t.equal( t1.name, renameTestMailingTitle )

}))

const T2 = 'rename from editor – empty rename get default title'
test( T2, createTest( 1, false, async (t, nm, close) => {
  await Promise.all( [serverReady, resetDB()] )

  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .type( rename.inputSelector, 'p' )
    .type( rename.inputSelector, '\u0008' )
    .use( checkName )

  await close()

  t.equal( t1.name, 'untitled' )

}))

const T3 = 'rename from editor – name of 1 space behave like empty'
test( T3, createTest( 1, false, async (t, nm, close) => {
  await Promise.all( [serverReady, resetDB()] )

  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .insert( rename.inputSelector, ' ' )
    .use( checkName )

  await close()

  t.equal( t1.name, 'untitled' )

}))

const T4 = 'rename from editor – admin can do it on a user mailing'
test( T4, createTest( 1, false, async (t, nm, close) => {
  await Promise.all( [serverReady, resetDB()] )

  const renameTestMailingTitle  = 'admin name'
  const t1 = await nm
    .use( connectAdmin() )
    .use( gotToEditor )
    .insert( rename.inputSelector, renameTestMailingTitle )
    .wait()
    .use( checkName )

  await close()

  t.equal( t1.name, renameTestMailingTitle)

}))

//////
// HOME
//////

// TBD
