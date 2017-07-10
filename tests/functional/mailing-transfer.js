const test            = require('tape')
const {
  createWindow,
  connectUser,
  connectAdmin,
  setupServer,
  getTeardownHandlers,
}                     = require('../_utils')

test('admin – transfer a mailing', t => {
  const nightmare           = createWindow(false)
  const data                = { _id: '580c4899e2c0b5462867f11c' }

  t.plan(2)
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectAdmin() )
    .goto(`http://localhost:8000/`)
    .wait(`.mailing-list`)
    .click(`a[href="/mailings/${data._id}/transfer"]`)
    .evaluate( () => {
      const userId = document.querySelector('select option:first-child').value
      return { userId }
    })
    .then( result => {
      data.userId = result.userId
      return nightmare
      .click(`.mdl-card__actions button`)
      .exists(`a[href="/mailings/${data._id}/transfer"]`)
    })
    .then( result => {
      t.notOk(result, 'no more links to this mailing in admin')
      return nightmare
      .goto(`http://localhost:8000/users/${data.userId}`)
      .exists(`a[href="/mailings/${data._id}"]`)
    })
    .then( onEnd( result => t.ok(result, `transfered mailing is owned by the right user`)) )
    .catch( onError )
  }
})
