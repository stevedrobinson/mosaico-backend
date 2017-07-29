'use strict'

// Handle async/await functions errors, without the need to try-catch
// https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016#3299
// https://strongloop.github.io/strongloop.com/strongblog/async-error-handling-expressjs-es7-promises-generators/#using-es7-asyncawait
const asyncMiddleware = fn => (...args) => fn(...args).catch(args[2])

module.exports = asyncMiddleware
