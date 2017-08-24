const test      = require('tape')
const {
  connectUser,
  connectAdmin,
  createTest, } = require('../_utils')

const WAIT_TIME           = 1
const data                = {
  ACTIVE_USER_ID: 'f30e44d8-7a54-41c9-8814-113a90e02f6e',
  NEW_USER_ID:    'e1d8af49-63c2-4638-a288-7e9461b516da',
  TEMPLATE_ID:    'b109c93c-679e-4a7c-8f84-9de3a13c1b38',
  GROUP_ID:       'c40dce03-7549-49f3-968a-8c77a7177425',
}

function getDialogTitle() {
  const dialogTitle = document.querySelector('.js-dialog-title')
  return {
    title: dialogTitle ? dialogTitle.textContent : false
  }
}

const T1 = 'admin - confirmation popup – user listing'
test( T1, createTest( 3, false, async (t, nm, close) => {
  await nm
    .use( connectAdmin() )
    .wait( WAIT_TIME )
    .goto( `http://localhost:8000/users` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'user listing - deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'user listing - reset dialog')

  // ACTIVATION
  const t3 = await nm
    .realClick( 'button.js-dialog-cancel' )
    .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t3.title, 'Activate', 'user listing - user activation dialog')

}))

const T2  = 'admin - confirmation popup – user card'
test( T2, createTest( 3, false, async (t, nm, close) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/users/${ data.ACTIVE_USER_ID }` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `.js-user-deactivate` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'user card - deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .realClick( `.js-reset-user`)
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'user card - reset dialog')

  // ACTIVATION
  await nm
    .goto( `http://localhost:8000/users/${data.NEW_USER_ID}` )
    .evaluate( () => false )

  const t3 = await nm
    .realClick( `.js-user-activate` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t3.title, 'Activate', 'user card - user activation dialog')

}))

const T3 = 'admin - confirmation popup – group card (user)'
test( T3, createTest( 3, false, async (t, nm, close) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )

  // DEACTIVATE
  const t1 = await nm
    .realClick( `a[href="#user-panel` )
    .wait( WAIT_TIME )
    .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t1.title, 'Deactivate', 'group card - user deactivation dialog')

  // RESET
  const t2 = await nm
    .realClick('button.js-dialog-cancel')
    .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  t.equal( t2.title, 'Reset', 'group card - user reset dialog')

  // ACTIVATION
  const t3 =  await nm
    .realClick('button.js-dialog-cancel')
    .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
    .wait( WAIT_TIME )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t3.title, 'Activate', 'group card - user activation dialog')

}))

const T4 = 'admin - confirmation popup – template listing'
test( T4, createTest( 1, false, async (t, nm, close) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))

const T5 = 'admin - confirmation popup – template card'
test( T5, createTest( 1, false, async (t, nm, close) => {
  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates/${ data.TEMPLATE_ID }` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `.js-delete-template` )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))


const T6 = 'admin - confirmation popup – group card (template)'
test( T6, createTest( 1, false, async (t, nm, close) => {

  await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )

  // DELETE
  const t1 = await nm
    .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
    .wait( `dialog[open]` )
    .wait( WAIT_TIME )
    .evaluate( getDialogTitle )

  await close()

  t.equal( t1.title, 'Delete template', 'template listing - delete dialog')

}))
