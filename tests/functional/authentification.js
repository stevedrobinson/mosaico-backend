const test            = require('tape')
const {
  connectUser,
  connectAdmin,
  createTest,
 }                    = require('../_utils')

const connectionSucces = async (t, nightmare, close) => {
  const t1 = await nightmare
    .use( connectUser() )
  await close()
  t.pass('user is connected')
}
test('connection success', createTest( connectionSucces, 1, false))


const connectionFail = async (t, nightmare, close) => {
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
  await close()
  t.equal( t1.errorMessage, 'This password is incorrect', 'user has an auth error')
}
test('connection fail', createTest( connectionFail, 1, false))


const adminConnection = async (t, nightmare, close) => {
  const t1 = await nightmare
    .use( connectAdmin() )
    .url()
  await close()
  t.equal('http://localhost:8000/admin', t1, 'admin is connected')

}
test('admin connection – success', createTest( adminConnection, 1, false))
