const test            = require('tape')

const {
  createWindow,
  connectUser,
  connectAdmin,
  setupServer,
  getTeardownHandlers,
}                     = require('../_utils')

test('admin – delete a template', t => {
  const nightmare           = createWindow(false)
  const waitTime            = 10
  const data                = {
    templateId: '5771fb054622d7a3d3f0d7a7',
    companyId:  '57c91dd2d8744e36669342bc',
  }

  t.plan(2)
  setupServer().then( start )

  function start(server) {
    const { onEnd, onError }  = getTeardownHandlers(t, nightmare, server)
    nightmare
    .use( connectAdmin() )
    .wait( waitTime )
    .goto(`http://localhost:8000/groups/${data.companyId}`)
    .wait( waitTime )
    .evaluate( findExistingTemplateLinks, data)
    .then( result => {
      t.equal( result.hasTemplateLink, true, 'template is present found and has mailings')
      return nightmare
      .goto(`http://localhost:8000/templates/${data.templateId}`)
      .click( 'a.js-delete-template' )
      .wait( waitTime )
      .click( `a.js-dialog-confirm` )
      .wait( waitTime )
      .wait( `a[href="#template-panel"]` )
      .evaluate( findTemplateLink, data )
    })
    .then( onEnd( result => {
      t.equal( result.hasntTemplateLink, true, 'template is nowhere to be found anymore')
    }) )
    .catch( onError )
  }

  function findExistingTemplateLinks( data ) {
    const templateLink = document.querySelectorAll(`a[href="/templates/${data.templateId}"]`)
    return { hasTemplateLink : templateLink.length > 1 }
  }

  function findTemplateLink( data ) {
    const templateLink = document.querySelectorAll(`a[href="/templates/${data.templateId}"]`)
    return { hasntTemplateLink : templateLink.length === 0 }
  }

})
