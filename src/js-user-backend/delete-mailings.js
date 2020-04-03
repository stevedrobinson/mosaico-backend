'use strict'
import jQuery from 'jquery'
window.$ = window.jQuery = jQuery

import logger from './_logger'
import pubsub from './_pubsub'

const DEBUG = false
const log = logger('delete mailing', DEBUG)
const $ui = {}

function init() {
  log('init')
  $ui.btn = $('.js-delete-mailings')
  if (!$ui.btn.length) return log.warn('abort init')
  bindUi()
  bindEvents()
}

function bindUi() {
  $ui.form = $('.js-action-form')
  $ui.dialog = $('.js-dialog-delete')
  $ui.mailingList = $('.js-delete-selection-list')
}

function bindEvents() {
  $ui.btn.on('click', toggleWarn)
  $('.js-close-delete-dialog').on('click', closeDialog)
  $('.js-delete-confirm').on('click', removeMailing)

  pubsub('table:selection').subscribe(updateMailingList)
}

function toggleWarn(e) {
  log('toggle warn')
  e.preventDefault()
  $ui.dialog[0].showModal()
}

function removeMailing() {
  log('remove mailing')
  $ui.form.attr('action', $ui.btn.attr('formaction')).submit()
}

function closeDialog() {
  log('close dialog')
  $ui.dialog[0].close()
}

function updateMailingList(e) {
  const { $checkboxes } = e
  const names = []
  $checkboxes
    .parent('td')
    .next()
    .find('a')
    .each((i, el) => {
      names.push(el.text)
    })
  $ui.mailingList.html(names.map(name => `<li>${name}</li>`))
}

init()
