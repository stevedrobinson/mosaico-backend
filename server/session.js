'use strict'

const passport      = require( 'passport')
const LocalStrategy = require( 'passport-local' ).Strategy
const session       = require( 'express-session' )
const flash         = require( 'express-flash' )
const RedisStore    = require( 'connect-redis' )( session )
const createError   = require( 'http-errors' )
const util          = require( 'util' )
const c             = require( 'chalk' )

const config        = require( './config' )
const h             = require( './helpers' )
const { User }      = require( './models' )

const adminUser = {
  isAdmin:  true,
  id:       config.admin.id,
  email:    config.emailOptions.from,
  name:     'admin',
}

const connectUser = async (username, password, done) => {
  // admin
  if (username === config.admin.username) {
    if (password === config.admin.password) {
      return done(null , adminUser)
    }
    return done(null, false, { message: 'password.error.incorrect' })
  }
  // user
  try {
    const user = await User.findOne({
      where: {
        email:          h.normalizeString( username ),
        isDeactivated:  { $not: true },
        token:          { $eq:  null },
        password:       { $not: null },
      },
    })
    // TODO email should be automatically filled with the previous value
    if (!user) return done(null, false, { message: 'password.error.nouser'} )
    const isPasswordValid = user.comparePassword( password )
    if (!isPasswordValid) return done(null, false, { message: 'password.error.incorrect' })
    return done(null, user)
  } catch( err ) {
    console.log( c.red('[SESSION] use find one – error') )
    console.log( err )
    return done(null, false, err)
  }
}

const serializeUser = (user, done) => {
  if (!user.isAdmin) {
    console.log( c.magenta('[SESSION] serialize user', user.id) )
  }
  done(null, user.id)
}

const deserializeUser = async (id, done) => {
  if (id === config.admin.id) return done(null, adminUser)
  console.log( c.magenta('[SESSION] deserialize user', id) )
  try {
    const user = await User.findOne({
      where: {
        id:            id,
        isDeactivated:  { $not: true },
        token:          { $eq:  null },
        password:       { $not: null },
      },
    })
    done(null, user)
  } catch( err ) {
    console.log('[PASSPORT] fail to deserialize User')
    console.trace( err )
    done(null, false, err)
  }
}

function init(app, redis) {

  passport.use( new LocalStrategy(connectUser) )
  passport.serializeUser( serializeUser )
  passport.deserializeUser( deserializeUser )

  const redisStore = new RedisStore( {client: redis} )
  app.use( session({
    secret:             'keyboard cat',
    resave:             false,
    saveUninitialized:  false,
    store:              redisStore,
  }) )

  // https://www.npmjs.com/package/connect-redis#how-do-i-handle-lost-connections-to-redis
  app.use( function (req, res, next) {
    if (!req.session) {
      return next(new Error('No redis connection')) // handle error
    }
    next() // otherwise continue
  } )
  app.use( flash() )
  app.use( passport.initialize() )
  app.use( passport.session() )
}

const guard = ( role = 'user' ) => (req, res, next) => {
  const isAdminRoute  = role === 'admin'
  const { user }      = req
  // connected user shouldn't acces those pages
  if (role === 'no-session') {
    if (user) return user.isAdmin ? res.redirect('/admin') : res.redirect('/')
  } else {
    // non connected user shouldn't acces those pages
    if (!user) {
      return isAdminRoute ? res.redirect('/admin/login') : res.redirect('/login')
    }
    // non admin user shouldn't acces those pages
    if (isAdminRoute && !user.isAdmin) {
      return next( createError(401) )
    }
  }
  next()
}

function logout(req, res, next) {
  const { isAdmin } = req.user
  req.logout()
  res.redirect(isAdmin ? '/admin' : '/')
  // https://stackoverflow.com/questions/13758207/why-is-passportjs-in-node-not-removing-session-on-logout
  // req.session.destroy(function (err) {
  //   res.redirect('/'); //Inside a callback… bulletproof!
  // });
}

module.exports = {
  init,
  session,
  passport,
  // without bind, passport is failing
  authenticate: passport.authenticate.bind(passport),
  guard,
  logout,
}
