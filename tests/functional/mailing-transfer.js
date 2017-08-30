'use strict'

const test      = require('tape')

const {
  data,
  connectUser,
  connectAdmin,
  createTest  } = require('../_test-utils')

const WAIT  = 2

const T1 = `MAILING – transfer a mailing from admin to user`
test( T1, createTest( false, async (t, nm) => {

  const userId = await nm
    .use( connectAdmin() )
    .goto( `http://localhost:8000/` )
    .wait( `.mailing-list` )
    .realClick( `a[href="/mailings/${data.ADMIN_MAILING_ID}/transfer"]` )
    .wait( WAIT )
    .evaluate( () => {
      const userId = document.querySelector('select option:first-child').value
      return userId
    })

  const t1 = await nm
    .realClick( `.mdl-card__actions button` )
    .wait( WAIT )
    .exists( `a[href="/mailings/${data.ADMIN_MAILING_ID}/transfer"]` )

  t.notOk( t1, `${T1} – no more links to this mailing in admin` )

  const t2 = await nm
    .goto(`http://localhost:8000/users/${userId}`)
    .wait( WAIT )
    .exists(`a[href="/mailings/${data.ADMIN_MAILING_ID}"]`)

  t.ok(t2, `${T1} – transfered mailing is owned by the right user`)

}))
