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
  MAILING_ID: '88e776cb-8062-4933-9589-6c24e1ec8e8c',
  TEST_NAME:  'mosaico-backend email',
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

const T1 = 'MAILING – rename from editor – can rename'
test( T1, createTest( 1, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .insert( rename.inputSelector, data.TEST_NAME )
    .use( checkName )

  t.equal( t1.name, data.TEST_NAME )

}))

const T2 = 'MAILING – rename from editor – empty rename get default title'
test( T2, createTest( 1, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .type( rename.inputSelector, 'p' )
    .type( rename.inputSelector, '\u0008' )
    .use( checkName )

  t.equal( t1.name, 'untitled' )

}))

const T3 = 'MAILING – rename from editor – name of 1 space behave like empty'
test( T3, createTest( 1, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const t1 = await nm
    .use( connectUser() )
    .use( gotToEditor )
    .insert( rename.inputSelector, ' ' )
    .use( checkName )

  t.equal( t1.name, 'untitled' )

}))

const T4 = 'MAILING – rename from editor – admin can do it on a user mailing'
test( T4, createTest( 1, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const t1 = await nm
    .use( connectAdmin() )
    .use( gotToEditor )
    .insert( rename.inputSelector, data.TEST_NAME )
    .wait()
    .use( checkName )

  t.equal( t1.name, data.TEST_NAME )

}))

//////
// HOME
//////

const T5 = 'MAILING – rename from home'
test( T5, createTest( 1, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const t1 =  await nm
    .use( connectUser() )
    .realClick( `.js-rename[data-href="/mailings/${ data.MAILING_ID }"]` )
    .insert( '#rename-field', false )
    .insert( '#rename-field', data.TEST_NAME )
    .realClick( '.js-dialog-rename .js-post' )
    .wait( 300 )
    .evaluate( data => {
      const selector  = `.js-name[href="/mailings/${ data.MAILING_ID }"]`
      const name      = document.querySelector( selector ).textContent
      return { name }
    }, data)

  t.equal( t1.name, data.TEST_NAME )

}))
