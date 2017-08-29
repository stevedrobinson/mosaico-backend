'use strict'

const test      = require('tape')
const {
  data,
  connectUser,
  connectAdmin,
  setupServer,
  resetDB,
  createTest, } = require('../_test-utils')
const { serverReady, stopServer } = setupServer()
test.onFinish( async _ => await stopServer() )

const WAIT      = 2
const selector  = {
  SUBMIT: `.js-filter button[type=submit]`,
  CLEAR:  `a#tt-clear-filter`,
}

const allMailings = nightmare => {
  return nightmare
    .goto( `http://localhost:8000/?page=1&limit=1000`)
    .wait( '.js-filter' )
    .realClick( `.js-toggle-filter` )
    .wait( WAIT )
}

const updateFilter = nightmare => {
  return nightmare
    .realClick( `.js-filter button[type=submit]`  )
    .wait( WAIT )
}

//////
// NAME
//////

const T1 = 'mailing – filter by name'
test( T1, createTest( 4, false, async (t, nm, close) => {

  const SEARCH   = 'pouic'

  const getNames = (SEARCH) => {
    const names       = document.querySelectorAll( `tbody tr td:nth-child(2)` )
    const countAll    = names.length
    const search      = new RegExp( SEARCH )
    const withPouic   = [...names].filter( n => search.test( n.textContent ) )
    const countPouic  = withPouic.length
    const searchSummary = document.querySelector( `.be-table-header__summary dd` )
    const summary       = searchSummary ? searchSummary.textContent : false
    return {countAll, countPouic, summary}
  }

  const initialState = await nm
    .use( connectUser() )
    .use( allMailings )
    .evaluate( getNames, SEARCH )

  const t1 = await nm
    .type( '#name-field' , 'pouic')
    .wait( WAIT )
    .use( updateFilter )
    .evaluate(  getNames, SEARCH )

  t.notEqual( t1.countAll, initialState.countAll, `${T1} – a filtering has been done` )
  t.equal( t1.countAll, initialState.countPouic, `${T1} – it's the right count` )
  t.equal( t1.countAll, t1.countPouic, `${T1} – it all countains the right string` )

  await close()

  t.equal( t1.summary, SEARCH, `${T1} – summary is the right one` )

}))

//////
// TEMPLATES
//////

const T2 = 'mailing – filter templates'
test( T2, createTest( 4, false, async (t, nm, close) => {
  await serverReady
  await resetDB()

  const getTemplates = () => {
    const templates  = document.querySelectorAll( `tbody tr td:nth-child(3)` )
    const names       = [...templates].map( e => e.textContent )
    // Set only store unic values
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
    const uniqNames     = Array.from( new Set( names ) )
    const count         = uniqNames.length
    const authorSummary = document.querySelector( `.be-table-header__summary dd` )
    const summary       = authorSummary ? authorSummary.textContent : false
    return { names: uniqNames, count, summary,  }
  }

  const initialState = await nm
    .use( connectUser() )
    .use( allMailings )
    .evaluate( getTemplates )

  t.ok( initialState.count > 1, `${T2} – we have more than one template to begin with` )

  // Has to do this in order to have a multiple selection…
  const setSelection = await nm
    .evaluate( templateId => {
      const select = document.querySelector( `#template-field` )
      if (!select) return false

      let option = select.querySelector( `option[value="${templateId}"]` )
      if (!option) return false
      option.selected = true

      const changeEvent = new Event('change')
      select.dispatchEvent( new Event('change') )
      return true
    }, data.VERSAFIX_ID )

  if ( !setSelection ) return t.end( `can't select a template `)

  const t1 = await nm
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getTemplates )

  t.equal( t1.count, 1, `${T2} – only selected template is left` )
  t.equal( t1.names.join(''), data.VERSAFIX_NAME, `${T2} – it's the right one` )

  await close()

  t.equal( t1.summary, data.VERSAFIX_NAME, `${T2} – summary is the right one` )

}))

//////
// AUTHORS
//////

const T3 = 'mailing – filter author'
test( T3, createTest( 4, false, async (t, nm, close) => {
  await serverReady
  await resetDB()

  const getAuthors = () => {
    const mailings  = document.querySelectorAll( `tbody tr td:nth-child(4)` )
    const names     = [...mailings].map( e => e.textContent )
    const uniqNames     = Array.from( new Set( names ) )
    const count         = uniqNames.length
    const authorSummary = document.querySelector( `.be-table-header__summary dd` )
    const summary       = authorSummary ? authorSummary.textContent : false
    return { names: uniqNames, count, summary,  }
  }

  const initialState = await nm
    .use( connectUser() )
    .use( allMailings )
    .evaluate( getAuthors )

  t.ok( initialState.count > 1, `we have more than one author to begin with` )

  const t1 = await nm
    .select( `#author-field`, data.ACTIVE_USER_ID )
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getAuthors )

  t.equal( t1.count, 1, `${T3} – only one author is left` )
  t.equal( t1.names[0], data.ACTIVE_USER_NAME, `${T3} – it's the right one` )

  await close()

  t.equal( t1.summary, data.ACTIVE_USER_NAME, `${T3} – summary is the right one` )

}))

//////
// TAGS
//////

