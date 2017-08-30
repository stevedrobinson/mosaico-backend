'use strict'

if (!/^8\./.test(process.versions.node)) {
  throw new Error('wrong node version. Should run on nodejs 8. See package.json#engines')
}

// https://devcenter.heroku.com/articles/node-concurrency
const throng      = require('throng')

const WORKERS     = process.env.WEB_CONCURRENCY || 1
const startWorker = require('./index')

throng({
  start:    startWorker,
  workers:  WORKERS,
  lifetime: Infinity,
})
