const test            = require('tape')
const {
  createWindow,
  connectUser,
  connectAdmin,
  setupServer,
  getTeardownHandlers,
 }                    = require('../_utils')

test('connection success', t => {
  const nightmare = createWindow( false )

  t.plan(1)
  setupServer().then( start )

  function start( server ) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectUser() )
    .then( onEnd( result => t.pass('user is connected') ) )
    .catch( onError )
  }

})

test('connection fail', t => {
  const nightmare = createWindow( false )

  t.plan(1)
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .goto('http://localhost:8000?lang=en')
    .insert('#email-field', 'p@p.com')
    .insert('#password-field', 'pp')
    .click('form[action*="/login"] [type=submit]')
    .exists('.is-invalid.is-dirty')
    .wait('dl.message.error')
    .evaluate( () => {
      const errorEl = document.querySelector('.message.error p')
      return { errorMessage: errorEl ? errorEl.textContent : false }
    } )
    .then( onEnd( result => {
      t.equal(result.errorMessage, 'This password is incorrect', 'user has an auth error')
    } ) )
    .catch( onError )
  }

})

test('admin connection – success', t => {
  const nightmare = createWindow( false )

  t.plan(1)
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectAdmin() )
    .url()
    .then( onEnd( url => t.equal('http://localhost:8000/admin', url, 'admin is connected') ) )
    .catch( onError )
  }

})
