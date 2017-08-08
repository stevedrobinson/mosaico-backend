'use strict'

// http://krasimirtsonev.com/blog/article/Nodejs-managing-child-processes-starting-stopping-exec-spawn
const util          = require( 'util' )
const { promisify } = util
const child_process = require( 'child_process' )
const exec          = promisify( child_process.exec )
const path          = require( 'path' )
const fs            = require( 'fs-extra' )
const c             = require( 'chalk' )
const inquirer      = require( 'inquirer' )
const pg            = require( 'pg' )

const config      = require( '../server/config' )
const u           = require( './_db-utils' )

const db          = config.dbConfigs
const { tables }  = u

async function start() {
  const conf        = await config.setup
  const tmpFolder   = conf.images.tmpDir
  const backups     = fs.readdirSync( tmpFolder ).filter( name => /^backup-/.test(name) ).reverse()
  const promptConf  = await inquirer.prompt([
    {
      type:     'list',
      name:     'folder',
      message:  `Please select a backup`,
      choices:  backups,
    },
    {
      type:     'list',
      name:     'destination',
      message:  `Choose ${c.magenta('destination')} DB`,
      choices:  Object.keys( db ),
    },
  ])
  const dbToName    = promptConf.destination
  const dbTo        = db[ dbToName ]
  const dumpFolder  = `${tmpFolder}/${promptConf.folder}`
  const { confirm } = await inquirer.prompt({
    type:     'confirm',
    default:  false,
    name:     'confirm',
    message:  `you are going to copy:
    ${c.green(promptConf.folder)} => ${c.magenta(dbToName)}`,
  })

  if ( !confirm ) {
    console.log( c.red('operation aborted') )
    return process.exit( 0 )
  }
  const command = `pg_restore --clean --if-exists --dbname=${dbTo} ${dumpFolder}/sql-dump.sqlc`
  await exec( command )
  console.log( c.green('replication done!') )
  process.exit( 0 )
}

start().catch( u.logErrorAndExit )



