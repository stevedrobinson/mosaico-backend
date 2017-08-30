'use strict'

const test      = require('tape')

const {
  data,
  connectUser,
  connectAdmin,
  createTest  } = require('../_test-utils')

const T1 = 'ADMIN – connection success'
test( T1, createTest( false, async (t, nm) => {

  const t1 = await nm
    .use( connectAdmin() )
    .url()

  t.equal('http://localhost:8000/admin', t1, `${T1} – admin is connected`)

}))
