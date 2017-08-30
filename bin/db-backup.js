'use strict'

const { promisify } = require( 'util' )
const child_process = require( 'child_process' )
const exec          = promisify( child_process.exec )
const c             = require( 'chalk' )
const moment        = require( 'moment' )
const inquirer      = require( 'inquirer' )
const path          = require( 'path' )
const fs            = require( 'fs-extra' )
const pg            = require( 'pg' )
const copyTo        = require( 'pg-copy-streams' ).to

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
    const filePath  = path.join(folderPath, `${tableName}` )
    const query     = `COPY "${tableName}" TO STDOUT ENCODING 'utf8'`
    const files     = [{
    //   query:  `${query}`,
    //   path:   `${filePath}.txt`,
    // }, {
      query:  `${query} CSV HEADER`,
      path:   `${filePath}.csv`,
    // }, {
    //   query:  `${query} BINARY`,
    //   path:   filePath,
    }]

    const operations = files.map( file => {
      const deferred    = h.defer()
      const writeStream = fs.createWriteStream( file.path, { encoding: 'utf8' } )
      const stream      = client.query( copyTo(file.query) )
      .pipe( writeStream )
      .on( 'error', deferred.reject )
      // wait for dest files to finish to be writen
      // https://github.com/brianc/node-pg-copy-streams/issues/61#issuecomment-277010285
      writeStream
      .on( 'finish', deferred.resolve )
      return deferred
    })

    return Promise.all( operations )
  }
  // make a CSV copy
  console.log( 'generating .csv' )
  await Promise.all( tables.map(copy) )
  await client.end()
  // dump it (this will be used by `db-sync`)
  const command = `pg_dump ${dbFrom} --format=c --file=${folderPath}sql-dump.sqlc`
  console.log( 'generating .sqlc' )
  await exec( command )
  console.log( c.green('backing up done'), c.grey('to'), folderPath )
  process.exit( 0 )
}

start().catch( u.logErrorAndExit )
