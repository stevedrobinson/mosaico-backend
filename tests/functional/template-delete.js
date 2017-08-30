'use strict'

const test      = require('tape')

const {
  data,
  connectUser,
  connectAdmin,
  createTest  } = require('../_test-utils')

const WAIT      = 2

const T1 = 'TEMPLATE – delete one'
test( T1, createTest( false, async (t, nm) => {

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

  t.equal( t1.templateCount > 1 , true, `${T1} – template is present found and has mailings`)

  const t2 = await nm
    .goto(`http://localhost:8000/templates/${ data.TEMPLATE_ID }`)
    .click( 'a.js-delete-template' )
    .wait( WAIT )
    .click( `a.js-dialog-confirm` )
    .wait( WAIT )
    .wait( `a[href="#template-panel"]` )
    .evaluate( findTemplateLink, data )

  t.equal( t2.templateCount < 1, true, `${T1} – template is nowhere to be found anymore`)

}))
