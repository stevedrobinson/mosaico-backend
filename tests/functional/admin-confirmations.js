'use strict'

const test      = require('tape')

const {
  data,
  connectUser,
  connectAdmin,
  createTest  } = require('../_test-utils')

const WAIT      = 2

function getDialogTitle() {
  const dialogTitle = document.querySelector('.js-dialog-title')
  return {
    title: dialogTitle ? dialogTitle.textContent : false
  }
}

//////
// USERS
//////

const T1 = 'admin - confirmation popup – user listing'
test( T1, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .wait( WAIT )
    .goto( `http://localhost:8000/users` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'user listing - deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .wait( `.js-dialog-title:empty` )
    .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'user listing - reset dialog')

  // ACTIVATION
  const t3 = await nm
    .realClick( 'button.js-dialog-cancel' )
    .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t3.title, 'Activate', 'user listing - user activation dialog')

}))

const T2  = 'admin - confirmation popup – user card'
test( T2, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/users/${ data.ACTIVE_USER_ID }` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `.js-user-deactivate` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'user card - deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .wait( `.js-dialog-title:empty` )
    .realClick( `.js-reset-user`)
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'user card - reset dialog')

  // ACTIVATION
  await nm
    .goto( `http://localhost:8000/users/${data.NEW_USER_ID}` )
    .evaluate( () => false )

  const t3 = await nm
    .realClick( `.js-user-activate` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t3.title, 'Activate', 'user card - user activation dialog')

}))

const T3 = 'admin - confirmation popup – group card (user)'
test( T3, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `a[href="#user-panel` )
    .wait( WAIT )
    .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'group card - user deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .wait( `.js-dialog-title:empty` )
    .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'group card - user reset dialog')

  // ACTIVATION
  const t3 =  await nm
    .realClick('button.js-dialog-cancel')
    .wait( `.js-dialog-title:empty` )
    .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
    .wait( WAIT )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t3.title, 'Activate', 'group card - user activation dialog')

}))

//////
// TEMPLATES
//////

const T4 = 'admin - confirmation popup – template listing'
test( T4, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))

const T5 = 'admin - confirmation popup – template card'
test( T5, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates/${ data.TEMPLATE_ID }` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `.js-delete-template` )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))

const T6 = 'admin - confirmation popup – group card (template)'
test( T6, createTest( false, async (t, nm) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
    .wait( `dialog[open]` )
    .wait( WAIT )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))
