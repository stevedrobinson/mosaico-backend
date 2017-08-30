'use strict'

const test      = require('tape')

const {
  data,
  connectUser,
  connectAdmin,
  createTest  } = require('../_test-utils')

const T1 = 'connection – user success'
test( T1, createTest( false, async (t, nm) => {

  const t1 = await nm.use( connectUser() )

  t.pass(`${T1} – user is connected`)

}))

const T2 = 'connection – user error'
test( T2, createTest( false, async (t, nm) => {

  const t1 = await nm
    .goto( 'http://localhost:8000?lang=en' )
    .insert( '#email-field', 'p@p.com' )
    .insert( '#password-field', 'pp' )
    .click( 'form[action*="/login"] [type=submit]' )
    .wait( 'dl.message.error' )
    .evaluate( () => {
      const errorEl = document.querySelector('.message.error p')
      return { errorMessage: errorEl ? errorEl.textContent : false }
    })

  t.equal( t1.errorMessage, 'This password is incorrect', `${T2} – user has an auth error` )

}))

const T3 = 'admin connection – success'
test( T3, createTest( false, async (t, nm) => {

  const t1 = await nm
    .use( connectAdmin() )
    .url()

  t.equal('http://localhost:8000/admin', t1, `${T3} – admin is connected`)

}))
