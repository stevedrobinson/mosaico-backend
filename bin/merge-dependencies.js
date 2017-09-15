'use strict'

const fs            = require( 'fs' )
const path          = require( 'path' )

const basePackage   = require( '../package.json' )
const dependencies  = { dependencies: basePackage.devDependencies }
const mergedPackage = Object.assign( {}, basePackage, dependencies )
delete mergedPackage.devDependencies
const filepath      = path.join( __dirname, '../package.json' )

fs.writeFileSync( filepath , JSON.stringify(mergedPackage, null, 2) )
