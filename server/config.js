'use strict';

const os          = require( 'os' )
const chalk       = require( 'chalk' )
const path        = require( 'path' )
const rc          = require( 'rc' )
const _           = require( 'lodash' )
const { inspect } = require( 'util' )
const { mkdirp }  = require( 'fs-extra' )


//----- DEFAULT CONFIG
// made for an easy use on local dev
const config  = rc('backend', {
  debug:          false,
  forcessl:       false,
  host:           'localhost:3000',
  database:       'mongodb://localhost/mosaico-backend',
  emailTransport: {
    host:         'localhost',
    port:         1025,
  },
  emailOptions: {
    from:               'Mosaico-backend test <info@mosaico-backend-test.name>',
    testSubjectPrefix:  '[mosaico-backend email builder]',
  },
  storage: {
    type:         'local',
  },
  images: {
    uploadDir:    'uploads',
    tmpDir:       'tmp',
    cache:        false,
  },
  admin: {
    id:           '576b90a441ceadc005124896',
    username:     'backend-admin',
    password:     'admin',
  },
  brand: {
    name:         'mosaico-backend',
  },
  // this is really optional.
  // It's just to be able to backup/restore DB with scripts
  dbConfigs: {
    local: {
      host:   'localhost:27017',
      folder: 'mosaico-backend',
    },
  },
  TEST:           false,
})

config.NODE_ENV       = config.NODE_ENV || process.env.NODE_ENV || 'development'
config.PORT           = process.env.PORT || 3000
config.TEST           = process.env.TEST ? true : false

config.isDev      = config.NODE_ENV === 'development'
config.isProd     = config.NODE_ENV === 'production'
config.isPreProd  = !config.isDev && !config.isProd
config.isAws      = config.storage.type === 'aws'

// last space is needed
config.emailOptions.testSubjectPrefix = `${config.emailOptions.testSubjectPrefix.trim()} `

//----- TEST SPECIFICS

if (config.TEST) {
  config.NODE_ENV         = 'development'
  config.host             = 'localhost:8000'
  config.PORT             = 8000
  config.storage.type     = 'local'
  config.images.uploadDir = 'uploads-test'
  config.dbConfigs        = {
    local: {
      host:   'localhost:27017',
      folder: 'mosaico-backend-test',
    },
  }
  console.log( chalk.green('[SERVER] running in TEST mode') )
}

//----- HEROKU ADDONS OVERRIDES

if ( config.SENDGRID_USERNAME && config.SENDGRID_PASSWORD ) {
  config.emailTransport.service = 'SendGrid'
  config.emailTransport.auth    = {
    user: config.SENDGRID_USERNAME,
    pass: config.SENDGRID_PASSWORD,
  }
}

if (config.MONGODB_URI) {
  config.database = config.MONGODB_URI
}

if (config.HEROKU_APP_NAME) {
  config.host = `${config.HEROKU_APP_NAME}.herokuapp.com`
}

// if ( config.isDev ) console.log( inspect(config) )
// http://stackoverflow.com/questions/12416738/how-to-use-herokus-ephemeral-filesystem
config.setup    = new Promise( (resolve, reject) => {
  var tmpPath     = path.join(__dirname, '/../', config.images.tmpDir)
  var uploadPath  = path.join(__dirname, '/../', config.images.uploadDir)
  var tmpDir      = mkdirp(tmpPath)
  var uploadDir   = config.isAws ? Promise.resolve(null) : mkdirp(uploadPath)

  Promise
  .all([tmpDir, uploadDir])
  .then( folders => {
    config.images.tmpDir    = tmpPath
    config.images.uploadDir = uploadPath
    resolve(config)
  })
  .catch( err => {
    console.log('folder exception')
    console.log('attempt with os.tmpdir()')
    console.log(err)
    var tmpPath     = path.join(os.tmpdir(), config.images.tmpDir)
    var uploadPath  = path.join(os.tmpdir(), config.images.uploadDir)
    var tmpDir      = mkdirp(tmpPath)
    var uploadDir   = config.isAws ? Promise.resolve(null) : mkdirp(uploadPath)

    Promise
    .all([tmpDir, uploadDir])
    .then( folders => {
      console.log('all done with os.tmpdir()')
      config.images.tmpDir    = tmpPath
      config.images.uploadDir = uploadPath
      resolve(config)
    })
    .catch( err => {
      reject(err)
      throw err
    })
  })
})

module.exports  = config
