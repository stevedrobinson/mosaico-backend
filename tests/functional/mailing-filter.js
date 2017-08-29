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
    .realClick( `.js-toggle-filter` )
    .wait( WAIT )
}

// Has to do this in order to have a multiple selection…
const selectMultiple = (selectQuery, value) => {
  const select = document.querySelector( selectQuery )
  if (!select) return false
  let option = select.querySelector( `option[value="${value}"]` )
  if (!option) return false
  option.selected = true
  const changeEvent = new Event('change')
  select.dispatchEvent( new Event('change') )
  return true
}

//////
// NAME
//////

const T1 = 'MAILING – filter by name'
test( T1, createTest( 4, false, async (t, nm) => {

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
  t.equal( t1.summary, SEARCH, `${T1} – summary is the right one` )

}))

//////
// TEMPLATES
//////

const T2 = 'MAILING – filter templates'
test( T2, createTest( 4, false, async (t, nm) => {
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

  const setSelection = await nm
    .evaluate( selectMultiple, `#template-field`, data.VERSAFIX_ID )

  if ( !setSelection ) return t.end( `can't select a template `)

  const t1 = await nm
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getTemplates )

  t.equal( t1.count, 1, `${T2} – only selected template is left` )
  t.equal( t1.names.join(''), data.VERSAFIX_NAME, `${T2} – it's the right one` )
  t.equal( t1.summary, data.VERSAFIX_NAME, `${T2} – summary is the right one` )

}))

//////
// AUTHORS
//////

const T3 = 'MAILING – filter author'
test( T3, createTest( 4, false, async (t, nm) => {
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
  t.equal( t1.summary, data.ACTIVE_USER_NAME, `${T3} – summary is the right one` )

}))

//////
// TAGS
//////

const T4 = 'MAILING – filter by tags'
test( T4, createTest( 13, false, async (t, nm) => {
  await serverReady
  await resetDB()

  const TAGS = ['silver', 'copper', 'gold']

  const getTags = TAGS => {
    const mailings    = document.querySelectorAll( `tbody tr td:nth-child(5)` )
    const tagsContent = [...mailings].map( m => m.textContent )
    const result      = { noTag: 0 }
    TAGS.forEach( t => result[ t ] = 0 )
    tagsContent.forEach( tagText => {
      tagText = tagText.trim()
      if (!tagText) return result.noTag += 1
      TAGS.forEach( t => tagText.indexOf( t ) >= 0 ? result[ t ] += 1 : void 0 )
    })
    return Object.freeze( result )
  }

  const initialState = await nm
    .use( connectUser() )
    .use( allMailings )
    .evaluate( getTags, TAGS )

  t.ok( initialState.noTag > 0, `${T4} – we have mailings without tags` )

  const t1 = await nm
    .evaluate( selectMultiple, `#tag-field`, TAGS[2] )
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getTags, TAGS )

  t.equal( t1.noTag, 0, `${T4} – mailings without tags are skipped` )
  t.equal( initialState[TAGS[2]], t1[TAGS[2]], `${T4} – third tag is preserved` )
  t.notEqual( initialState[TAGS[1]], t1[TAGS[1]], `${T4} – second tag is skipped` )
  t.notEqual( initialState[TAGS[0]], t1[TAGS[0]], `${T4} – first tag is skipped` )

  const t2 = await nm
    .evaluate( selectMultiple, `#tag-field`, TAGS[1] )
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getTags, TAGS )

  t.equal( t2.noTag, 0, `${T4} – mailings without tags are skipped` )
  t.equal( initialState[TAGS[2]], t2[TAGS[2]], `${T4} – third tag is preserved` )
  t.equal( initialState[TAGS[1]], t2[TAGS[1]], `${T4} – second selected tag is preserved` )
  t.notEqual( initialState[TAGS[0]], t2[TAGS[0]], `${T4} – first tag is still skipped` )

  const t3 = await nm
    .evaluate( selectMultiple, `#tag-field`, TAGS[0] )
    .wait( WAIT )
    .use( updateFilter )
    .evaluate( getTags, TAGS )

  t.equal( t3.noTag, 0, `${T4} – mailings without tags are skipped` )
  t.equal( initialState[TAGS[2]], t3[TAGS[2]], `${T4} – third tag is preserved` )
  t.equal( initialState[TAGS[1]], t3[TAGS[1]], `${T4} – second selected tag is preserved` )
  t.equal( initialState[TAGS[0]], t3[TAGS[0]], `${T4} – first selected is preserved` )

}))
