'use strict'

const fs                  = require( 'fs' )
const path                = require( 'path' )

const basePackage         = require( '../package.json' )
const {
  dependencies,
  devDependencies,
}                         = basePackage
basePackage.dependencies  = Object.assign( {}, dependencies, devDependencies )
delete basePackage.devDependencies
const filepath            = path.join( __dirname, '../package.json' )

fs.writeFileSync( filepath , JSON.stringify(basePackage, null, 2) )
