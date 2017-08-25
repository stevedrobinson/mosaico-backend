const test            = require('tape')
const {
  createWindow,
  connectUser,
  setupServer,
  getTeardownHandlers
}                     = require('../_utils')

test('duplicate', t => {
  const nightmare           = createWindow(false)

  t.plan(1)
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectUser() )
    .click('.js-tbody-selection tr:first-child td:last-child a')
    .wait('.mailing-list')
    .evaluate( () => {
      const originalName  = document.querySelector('.js-tbody-selection tr:nth-child(2) > td:nth-child(2) > a').textContent
      const copyName      = document.querySelector('.js-tbody-selection tr:nth-child(1) > td:nth-child(2) > a').textContent
      return { originalName, copyName }
    })
    .end()
    .then( onEnd( result => {
      const { originalName,  copyName } = result
      t.equal(copyName, `${originalName} copy`, 'same name + copy suffix')
    } ) )
    .catch( onError )
  }

})

test('batch deletion', t => {
  const nightmare           = createWindow( false )
  const waitTime            = 20
  const data                = { }

  t.plan( 3 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectUser() )
    .select( `select.js-pagination`, `/?page=1&limit=50` )
    .wait( waitTime )
    .evaluate( getMailingCount, data )
    .then( result => {
      data.inititalMailingCount = result.mailingCount
      return nightmare
      .check( `tbody tr:nth-child(1) input` )
      .check( `tbody tr:nth-child(2) input` )
      .wait( waitTime )
      .evaluate( getHeaderSelectionCount, data )
    })
    .then( result => {
      t.equal( result.headerSelectionCount, 2, 'batch deletion - selection is counted correctly on the header')
      return nightmare
      .click( `button.js-delete-mailings` )
      .wait( waitTime )
      .evaluate( getDialogSelectionCount, data )
    })
    .then( result => {
      t.equal( result.dialogSelectionCount, 2, 'batch deletion - selection is counted correctly on the dialog')
      return nightmare
      .click( `button.js-delete-confirm` )
      .wait( waitTime )
      .evaluate( getMailingCount, data )
    })
    .then( onEnd( result => {
      t.equal( result.mailingCount, data.inititalMailingCount - 2, 'batch deletion - mailings have been deleted')

    }) )
    .catch( onError )
  }

  function getMailingCount( data ) {
    return { mailingCount: document.querySelectorAll( `tbody tr` ).length }
  }

  function getHeaderSelectionCount( data ) {
    const title   = document.querySelector(`.js-selection-count`)
    const text    = title ? title.textContent : ''
    const number  = /^(\d+)/.exec( text )
    const founded = number ? ~~number[1] : false
    return { headerSelectionCount: founded }
  }
  function getDialogSelectionCount( data ) {
    return { dialogSelectionCount: document.querySelectorAll( `.js-delete-selection-list li` ).length }
  }

})

test('filter', t => {
  const nightmare           = createWindow( false )
  const waitTime            = 20
  const data                = {
    userName:     `OTTO Van Der Toto`,
    userId:       `57d930f9db23313831bc1713`,
    templateName: [ `versafix-1`, `versafix-2`],
    templateId:   [ `579625a447df3e1a1531c056`, `57c282facbd36db78623b021` ],
  }
  const selector            = {
    toggleFilter: `.js-toggle-filter`,
    submitFilter: `.js-filter button[type=submit]`,
    clearFilter:  `a#tt-clear-filter`,
  }

  t.plan( 6 )
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectUser() )
    .select( `select.js-pagination`, `/?page=1&limit=50` )
    .wait( waitTime )
    .click( selector.toggleFilter )
    .wait( waitTime )
    .select( `#author-field`, data.userId )
    .click( selector.submitFilter )
    .wait( waitTime )
    .evaluate( getMailingCountAndAuthor, data )
    .then( result => {
      t.equal( result.names.length, 1, `author filter – only one author is left` )
      t.equal( result.names[0], data.userName, `author filter – it's the right one` )
      t.equal( result.summary, data.userName, `author filter – summary is the right one` )
      return nightmare
      .click( selector.clearFilter )
      .wait( waitTime )
      .click( selector.toggleFilter )
      .evaluate( setTemplatesFilter, data )
    })
    .then( result => {
      return nightmare
      .wait( waitTime )
      .click( selector.submitFilter )
      .wait( waitTime )
      .evaluate( getTemplateCountAndAuthor, data )
    })
    .then( onEnd( result => {
      t.equal( result.names.length, data.templateId.length, `templates filter – only selected templates are left` )
      t.equal( result.names.join(''), data.templateName.join(''), `templates filter – it's the right ones` )
      t.equal( result.summary, data.templateName.join(', '), `templates filter – summary is the right one` )
    }) )
    .catch( onError )
  }

  function getMailingCountAndAuthor( data ) {
    const mailings  = document.querySelectorAll( `tbody tr td:nth-child(4)` )
    const names     = [...mailings].map( e => e.textContent )
    // Set only store unic values
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
    const uniqNames     = Array.from( new Set( names ) )
    const authorSummary = document.querySelector( `.be-table-header__summary dd` )

    return { names: uniqNames, summary: authorSummary ? authorSummary.textContent : false }
  }

  function setTemplatesFilter( data ) {
    // Has to do this in order to have a multiple selection…
    const select = document.querySelector( `#template-field` )
    if (!select) return {}
    for (let id of data.templateId) {
      let option = select.querySelector( `option[value="${id}"]` )
      if (option) option.selected = true
    }
    const changeEvent = new Event('change')
    select.dispatchEvent( new Event('change') )
    return {}
  }

  function getTemplateCountAndAuthor( data ) {
    const templates = document.querySelectorAll( `tbody tr td:nth-child(3)` )
    const names     = [...templates].map( e => e.textContent )
    const uniqNames = [...new Set( names )].sort()
    const summary   = document.querySelector( `.be-table-header__summary dd` )
    return { names: uniqNames, summary: summary ? summary.textContent : false }
  }

})
