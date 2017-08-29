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

const data = {
  WAIT:         1,
  TEMPLATE_ID:  'b109c93c-679e-4a7c-8f84-9de3a13c1b38',
  GROUP_ID:     'c40dce03-7549-49f3-968a-8c77a7177425',
}

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
    .wait( data.WAIT )
    .goto(`http://localhost:8000/groups/${ data.GROUP_ID} `)
    .wait( data.WAIT )
    .evaluate( findTemplateLink, data)

  t.equal( t1.templateCount > 1 , true, 'template is present found and has mailings')

  const t2 = await nm
    .goto(`http://localhost:8000/templates/${ data.TEMPLATE_ID }`)
    .click( 'a.js-delete-template' )
    .wait( data.WAIT )
    .click( `a.js-dialog-confirm` )
    .wait( data.WAIT )
    .wait( `a[href="#template-panel"]` )
    .evaluate( findTemplateLink, data )

  await close()

  t.equal( t2.templateCount < 1, true, 'template is nowhere to be found anymore')

}))
