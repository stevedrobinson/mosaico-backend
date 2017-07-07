'use strict'

var $       = require('jquery')
var ko      = require('knockout')
var console = require('console')

function handleMailingName(viewModel) {
  var originalValue
  viewModel.titleMode         = ko.observable('show')
  viewModel.metadata.name     = ko.observable(viewModel.metadata.name)

  viewModel.mailingName       = ko.computed(function() {
    return viewModel.metadata.name()
  }, viewModel)

  viewModel.enableEditMailingName  = function (data, event) {
    console.log('enableEditMailingName', data)
    originalValue = viewModel.metadata.name()
    viewModel.titleMode('edit')
  }

  viewModel.cancelEditMailingName  = function (data, event) {
    console.log('cancelEditMailingName')
    viewModel.metadata.name(originalValue)
    originalValue = ''
    viewModel.titleMode('show')
  }

  viewModel.saveEditMailingName  = function (data, event) {
    console.log('saveEditMailingName', viewModel.metadata.name())
    viewModel.titleMode('saving')
    viewModel.notifier.info(viewModel.t('edit-title-ajax-pending'))

    $.ajax({
      method: 'POST',
      url:    viewModel.metadata.url.update,
      data:   {
        name: viewModel.metadata.name(),
      },
      success: function (mosaicoMailing) {
        viewModel.metadata.name( mosaicoMailing.meta.name )
        viewModel.notifier.success(viewModel.t('edit-title-ajax-success'))
      },
      error: function () {
        viewModel.notifier.error(viewModel.t('edit-title-ajax-fail'))
      },
      complete: function () {
        originalValue = ''
        viewModel.titleMode('show')
      },
    })
  }
}

module.exports = handleMailingName
