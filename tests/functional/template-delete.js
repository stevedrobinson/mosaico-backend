'use strict'

const test      = require('tape')
const {
  data,
  connectUser,
  connectAdmin,
  setupServer,
  resetDB,
  createTest, } = require('../_test-utils')
const { serverReady, stopServer } = setupServer()
test.onFinish( async _ => await stopServer() )

const WAIT  = 2

const T1 = 'delete one'
test( T1, createTest( 2, false, async (t, nm, close) => {
  await serverReady
  await resetDB()

  const findTemplateLink = data => {
    const selector      = `a[href="/templates/${data.TEMPLATE_ID}"]`
    const templateLink  = document.querySelectorAll( selector )
    return { templateCount : templateLink.length }
  }

  const t1 = await nm
    .use( connectAdmin() )
    .wait( WAIT )
    .goto(`http://localhost:8000/groups/${ data.GROUP_ID} `)
    .wait( WAIT )
    .evaluate( findTemplateLink, data)

  t.equal( t1.templateCount > 1 , true, 'template is present found and has mailings')

  const t2 = await nm
    .goto(`http://localhost:8000/templates/${ data.TEMPLATE_ID }`)
    .click( 'a.js-delete-template' )
    .wait( WAIT )
    .click( `a.js-dialog-confirm` )
    .wait( WAIT )
    .wait( `a[href="#template-panel"]` )
    .evaluate( findTemplateLink, data )

  await close()

  t.equal( t2.templateCount < 1, true, 'template is nowhere to be found anymore')

}))
