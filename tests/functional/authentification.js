const test            = require('tape')
const {
  setup,
  createWindow,
  connectUser,
  connectAdmin,
  setupServer,
  getTeardownHandlers,
 }                    = require('../_utils')

test('connection success', async t => {
  const { nightmare, closeNightmare } =  await setup( false )

  t.plan(1)
  try {

    const t1 = await nightmare.use( connectUser() )
    await closeNightmare()
    t.pass('user is connected')

  } catch(err) {
    await closeNightmare()
    t.end(err)
  }
})

test('connection fail', async t => {
  const { nightmare, closeNightmare } =  await setup( false )

  t.plan(1)
  try {

    const t1 = await nightmare
      .goto('http://localhost:8000?lang=en')
      .insert('#email-field', 'p@p.com')
      .insert('#password-field', 'pp')
      .click('form[action*="/login"] [type=submit]')
      .wait('dl.message.error')
      .evaluate( () => {
        const errorEl = document.querySelector('.message.error p')
        return { errorMessage: errorEl ? errorEl.textContent : false }
      } )
    await closeNightmare()
    t.equal( t1.errorMessage, 'This password is incorrect', 'user has an auth error')

  } catch(err) {
    await closeNightmare()
    t.end(err)

  }
})

test('admin connection – success', async t => {
  const { nightmare, closeNightmare } =  await setup( false )

  t.plan(1)
  try {
    const t1 = await nightmare
      .use( connectAdmin() )
      .url()
    await closeNightmare()
    t.equal('http://localhost:8000/admin', t1, 'admin is connected')

  } catch(err) {
    await closeNightmare()
    t.end(err)
  }
})
