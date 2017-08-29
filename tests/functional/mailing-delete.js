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

const WAIT  = 2

const T1 = 'MAILING – batch deletion'
test( T1, createTest( 3, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const getMailingCount = () => document.querySelectorAll( `.js-name` ).length

  const inititalMailingCount = await nm
  .use( connectUser() )
  .goto( `http://localhost:8000/?page=1&limit=1000`)
  .wait( WAIT )
  .evaluate( getMailingCount )

  const t1 = await nm
    .check( `tbody tr:nth-child(1) input` )
    .check( `tbody tr:nth-child(2) input` )
    .wait( WAIT )
    .evaluate( () => {
      const title   = document.querySelector( `.js-selection-count` )
      const text    = title ? title.textContent : ''
      const number  = /^(\d+)/.exec( text )
      return number ? ~~number[1] : false
    })

  t.equal( t1, 2, `${T1} - selection is counted correctly on the dialog`)

  const t2 = await nm
    .realClick( `button.js-delete-mailings` )
    .wait( WAIT )
    .evaluate( () => document.querySelectorAll( `.js-delete-selection-list li` ).length )

  t.equal( t2, 2, `${T1} - selection is counted correctly on the dialog`)

  const t3 = await nm
    .realClick( `button.js-delete-confirm` )
    .wait( WAIT )
    .evaluate( getMailingCount )

  t.equal( t3, inititalMailingCount - 2, `${T1} - mailings have been deleted`)

}))
