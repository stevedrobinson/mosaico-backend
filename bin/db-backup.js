'use strict'

const exec      = require( 'child_process' ).exec
const c         = require( 'chalk' )
const moment    = require( 'moment' )
const inquirer  = require( 'inquirer' )
const path      = require( 'path' )
const fs        = require( 'fs-extra' )
const pg        = require( 'pg' )
const copyTo    = require( 'pg-copy-streams' ).to

const config      = require( '../server/config' )
const db          = config.dbConfigs
const now         = moment().format( 'YYYY-MM-DD_HH-mm' )
const h           = require( '../server/helpers' )
const u           = require( './_db-utils' )
const { tables }  = u

const selectDb    = inquirer.prompt([
  {
    type:     'list',
    name:     'source',
    message:  `Choose a ${c.green('source')} DB to backup`,
    choices:  Object.keys(db),
  },
])

async function start() {
  const [ promptConf, conf ] = await Promise.all( [selectDb, config.setup] )
  const sourceName  = promptConf.source
  const dbFrom      = db[ sourceName ]
  const tmpFolder   = conf.images.tmpDir
  const client      = new pg.Client( { connectionString: dbFrom })
  const folderPath  = path.join(tmpFolder, `/backup-${sourceName}_${now}/` )

  console.log( c.blue('Backing up'), sourceName, dbFrom )
  await Promise.all([
    client.connect(),
    fs.ensureDir( folderPath ),
  ])

  function copy( tableName ) {
    const filePath  = path.join(folderPath, `${tableName}.csv` )
    const deferred  = h.defer()
    // quotes are needed to force respecting case
    const query     = `COPY "${tableName}" TO STDOUT CSV HEADER`
    // const query     = `COPY ${tableName} TO STDOUT WITH (FORMAT CSV, HEADER, QUOTE '"', FORCE_QUOTE *)`
    fs.ensureFileSync( filePath )
    const writeStream   = fs.createWriteStream(filePath)
    const stream        = client.query( copyTo(query) )
    stream
    .pipe( writeStream )
    .on( 'error', deferred.reject )
    // wait for dest files to finish to be writen
    // https://github.com/brianc/node-pg-copy-streams/issues/61#issuecomment-277010285
    writeStream
    .on( 'finish', deferred.resolve )
    return deferred
  }

  try {
    await Promise.all( tables.map(copy) )
  } catch(e) {
    console.log( e )
    return process.exit( 1 )
  }
  await client.end()
  console.log( c.green('backing up done'), c.grey('to'), folderPath )
  process.exit( 0 )
}

start()
