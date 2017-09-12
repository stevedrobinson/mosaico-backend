'use strict'

if (!/^8\./.test(process.versions.node)) {
  throw new Error('wrong node version. Should run on nodejs 8. See package.json#engines')
}

// https://devcenter.heroku.com/articles/node-concurrency
const throng      = require('throng')

const WORKERS     = process.env.WEB_CONCURRENCY || 1
const startServer = require('./index')

throng({
  start(id) {
    startServer().catch( e => console.log('issue at server init', e)  )
  },
  workers:  WORKERS,
  // ms to keep cluster alive (Infinity)
  // don't keep to infinity so it can close on error :D
  lifetime: 0,
})
