const test            = require('tape')
const {
  createWindow,
  connectUser,
  connectAdmin,
  setupServer,
  getTeardownHandlers,
}                     = require('../_utils')

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

test('admin - confirmation popup – user listing', t => {
  const nightmare           = createWindow( false )

  t.plan( 3 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .wait( WAIT_TIME )
    .goto( `http://localhost:8000/users` )
    .evaluate( () => false )
    .then( _ => {
      // DEACTIVATE
      return nightmare
      .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    })
    .then( result => {
      console.log('currentTry', result.currentTry)
      t.equal( result.title, 'Deactivate', 'user listing - deactivation dialog')
      // RESET
      return nightmare
      .realClick('button.js-dialog-cancel')
      .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( result => {
      console.log('currentTry', result.currentTry)
      t.equal( result.title, 'Reset', 'user listing - reset dialog')
      // ACTIVATION
      return nightmare
      .realClick( 'button.js-dialog-cancel' )
      .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      console.log('currentTry', result.currentTry)
      t.equal( result.title, 'Activate', 'user listing - user activation dialog')
    } ))
    .catch( onError )
  }
})

test('admin - confirmation popup – user card', t => {
  const nightmare           = createWindow(false)

  t.plan( 3 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .goto( `http://localhost:8000/users/${ data.ACTIVE_USER_ID }` )
    .evaluate( () => false )
    .then( _ => {
      return nightmare
      // DEACTIVATE
      .realClick( `.js-user-deactivate` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    })
    .then( result => {
      t.equal( result.title, 'Deactivate', 'user card - deactivation dialog')
      // RESET
      return nightmare
      .realClick('button.js-dialog-cancel')
      .realClick( `.js-reset-user`)
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( result => {
      t.equal( result.title, 'Reset', 'user card - reset dialog')
      return nightmare
      .realClick('button.js-dialog-cancel')
      .goto( `http://localhost:8000/users/${data.NEW_USER_ID}` )
      .evaluate( () => false )
    })
    .then( result => {
      // ACTIVATION
      return nightmare
      .realClick( `.js-user-activate` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      t.equal( result.title, 'Activate', 'user card - user activation dialog')
    } ))
    .catch( onError )
  }
})

test('admin - confirmation popup – group card (user)', t => {
  const nightmare           = createWindow(false)

  t.plan( 3 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )
    .then( _ => {
      // DEACTIVATE
      return nightmare
      .realClick( `a[href="#user-panel` )
      .wait( WAIT_TIME )
      .realClick( `a[href="/users/${ data.ACTIVE_USER_ID }?_method=DELETE"` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    })
    .then( result => {
      t.equal( result.title, 'Deactivate', 'group card - user deactivation dialog')
      return nightmare
      .realClick('button.js-dialog-cancel')
      // RESET
      .realClick( `a[href^="/users/${ data.ACTIVE_USER_ID }/reset"]`)
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( result => {
      t.equal( result.title, 'Reset', 'group card - user reset dialog')
      return nightmare
      .realClick('button.js-dialog-cancel')
      // ACTIVATION
      .realClick( `a[href="/users/${ data.NEW_USER_ID }/activate"]` )
      .wait( WAIT_TIME )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      t.equal( result.title, 'Activate', 'group card - user activation dialog')
    } ))
    .catch( onError )
  }
})

test('admin - confirmation popup – template listing', t => {
  const nightmare           = createWindow(false)

  t.plan( 1 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates` )
    .evaluate( () => false )
    .then( _ => {
      // DELETE
      return nightmare
      .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      t.equal( result.title, 'Delete template', 'template listing - delete dialog')
    } ))
    .catch( onError )
  }
})

test('admin - confirmation popup – template card', t => {
  const nightmare           = createWindow(false)

  t.plan( 1 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .goto( `http://localhost:8000/templates/${ data.TEMPLATE_ID }` )
    .evaluate( () => false )
    .then( _ => {
      // DELETE
      return nightmare
      .realClick( `.js-delete-template` )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      t.equal( result.title, 'Delete template', 'template listing - delete dialog')
    } ))
    .catch( onError )
  }
})

test('admin - confirmation popup – group card (template)', t => {
  const nightmare           = createWindow(false)

  t.plan( 1 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)

    nightmare
    .use( connectAdmin() )
    .goto( `http://localhost:8000/groups/${ data.GROUP_ID }` )
    .evaluate( () => false )
    .then( _ => {
      // DELETE
      return nightmare
      .realClick( `a[href^="/templates/${ data.TEMPLATE_ID }?_method=DELETE"` )
      .wait( `dialog[open]` )
      .wait( WAIT_TIME )
      .evaluate( getDialogTitle )
    } )
    .then( onEnd( result => {
      t.equal( result.title, 'Delete template', 'template listing - delete dialog')
    } ))
    .catch( onError )
  }
})
