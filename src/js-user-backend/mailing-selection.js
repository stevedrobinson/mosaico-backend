import $ from 'jquery'

import logger from './_logger'
import pubsub from './_pubsub'

const DEBUG     = false
const log       = logger('mailing selection', DEBUG)
const $ui       = {}
const messages  = window.badesenderI18n.table.selection

function init() {
  log('init')
  $ui.container = $('.js-line-selection')
  if (!$ui.container.length) return log.warn('abort init')
  bindUi()
  bindEvents()
}

function bindUi() {
  $ui.actions           = $('.js-line-actions')
  $ui.selectAll         = $('.js-mailing-selection-all')
  $ui.selectionCount    = $('.js-selection-count')
  $ui.tbody             = $ui.container.find('tbody')
  $ui.checkboxes        = $ui.tbody.find('input')
}

function bindEvents() {
  $ui.tbody.on('change' , toggle)
  $ui.selectAll.on('change', toggleAll)
}

function toggle(e) {
  log('toggle one')
  updateTable()
}

function updateTable() {
  const $checked        = $ui.checkboxes.filter(':checked')
  const mailingsCount   = $checked.length
  const isPlural        = mailingsCount < 2
  const message         = messages[ isPlural ? 'singular' : 'plural' ]

  log('updateTable', mailingsCount)
  $ui.selectionCount.text( `${mailingsCount} ${message}`)
  $ui.actions[ mailingsCount ? 'addClass' : 'removeClass']('is-visible')
  pubsub('table:selection').publish({
    count:            mailingsCount,
    isNoSelection:    mailingsCount === 0,
    isFullSelection:  mailingsCount === $ui.checkboxes.length,
    $checkboxes:      $ui.checkboxes.filter(':checked'),
  })
}

function toggleAll() {
  log('toggle all')
  const state = $ui.selectAll.is(':checked')
  $ui.checkboxes.prop('checked', state)
  updateTable()
}

init()
