'use strict'

const _           = require( 'lodash' )
const qs          = require( 'qs' )
const { inspect } = require( 'util' )
const createError = require( 'http-errors' )
const moment      = require( 'moment' )
const { Types }   = require( 'mongoose' )

const config        = require( './config' )
const filemanager   = require( './filemanager' )
const {
  Template,
  Mailing,
  Galleries,
  User,
  Tag,
  addGroupFilter,
  addStrictGroupFilter,
}                         = require( './models' )
const cleanTagName        = require( '../shared/clean-tag-name' )
const h                   = require( './helpers' )

const translations  = {
  en: JSON.stringify(_.assign(
    {},
    require('../res/lang/mosaico-en.json'),
    require('../res/lang/custom-en')
  )),
  fr: JSON.stringify(_.assign(
    {},
    require('../res/lang/mosaico-fr.json'),
    require('../res/lang/custom-fr')
  )),
}

//////
// HOME LISTING
//////

const perpage = 25

async function userList(req, res, next) {
  const { query, user}        = req
  const { isAdmin, groupId }  = user
  const groupFilter           = isAdmin ? { $eq: null }  : groupId
  const mailingsParams        = {
    where: {
      groupId: groupFilter,
    },
    include: [{
      model:    User,
      required: false,
    }, {
      model:    Template,
      required: false,
    }, {
      model:    Tag,
      required: false,
    }],
  }
  const queries = [
    Mailing.findAll( mailingsParams ),
    Template.findAll( isAdmin ? {} : {where: { groupId: groupFilter}} ),
    isAdmin ? Promise.resolve( false ) : User.findAll( {where: { groupId }} )
  ]
  const [
    mailings,
    templates,
    users,
  ]             = await Promise.all( queries )
  const data    = {
    mailings: mailings.map( mail => mail.toJSON() ) ,
    users: [],
    templates: [],
    tagsList: [],
    // tagsList:  tags.map( t => t._id ),
    pagination: {},
    filterQuery: {},
    summary: {},
  }
  console.log( inspect(data, {depth: 1}), )

  res.render('mailing-list', { data: data } )
  // // admin doesn't have a group
  // const _group        = isAdmin ? { $exists: false } : req.user._group

  // //----- PAGINATION

  // // Pagination could be done better
  // // http://stackoverflow.com/questions/5539955/how-to-paginate-with-mongoose-in-node-js/23640287#23640287
  // // https://scalegrid.io/blog/fast-paging-with-mongodb/
  // const pagination  = {
  //   page:   query.page ? ~~query.page - 1 : 0,
  //   limit:  query.limit ? ~~query.limit : perpage,
  // }
  // pagination.start  = pagination.page * pagination.limit

  // //----- SORTING

  // const sorting     = {
  //   sort: query.sort  ? query.sort  : 'updatedAt',
  //   dir:  query.dir   ? query.dir   : 'desc',
  // }
  // // beware that sorting on populated keys won't work
  // const sort = { [sorting.sort]: sorting.dir === 'desc' ? -1 : 1}

  // //----- FILTERING

  // // CLEANING QUERY

  // // remove empty fields
  // let filterQuery = _.pick( query, ['name', '_user', '_template', 'createdAt', 'updatedAt', 'tags'] )
  // ;['createdAt', 'updatedAt'].forEach( key => {
  //   if (!query[key]) return
  //   filterQuery[ key ]  = _.omitBy( filterQuery[ key ], value => value === '' )
  // })
  // filterQuery           = _.omitBy( filterQuery, value => {
  //   const isEmptyString = value === ''
  //   const isEmptyObject = _.isPlainObject(value) && Object.keys(value) < 1
  //   return isEmptyString || isEmptyObject
  // } )

  // const filterKeys    = Object.keys( filterQuery )

  // // normalize array
  // let arrayKeys = ['_user', '_template', 'tags']
  // arrayKeys     = _.intersection( arrayKeys, filterKeys )
  // for (let key of arrayKeys) {
  //   filterQuery[ key ] = _.concat( [], filterQuery[ key ] )
  // }

  // // CONSTRUCT MONGODB FILTER

  // const filter  = { _group }
  // // text search can be improved
  // // http://stackoverflow.com/questions/23233223/how-can-i-find-all-documents-where-a-field-contains-a-particular-string
  // if (filterQuery.name) filter.name = new RegExp(filterQuery.name)
  // // SELECT
  // for (let keys of arrayKeys ) { filter[keys] = { $in: filterQuery[keys] } }
  // // DATES
  // // for…of breaks on return, use forEach
  // const datesFilterKeys = _.intersection( ['createdAt', 'updatedAt'], filterKeys )
  // datesFilterKeys.forEach( key => {
  //   const rangeKeys = _.intersection( ['$lte', '$gte'], Object.keys( filterQuery[key] ) )
  //   rangeKeys.forEach( range => {
  //     // force UTC time for better comparison purpose
  //     const date = moment(`${filterQuery[key][range]} +0000`, 'YYYY-MM-DD Z')
  //     if (!date.isValid()) return
  //     // day begin at 00h00… go to the next ^^
  //     if (range === '$lte') date.add(1, 'days')
  //     filter[key]         = filter[key] || {}
  //     filter[key][range]  = date.toDate()
  //   })
  // })

  // //----- CREATE DB QUERIES

  // // don't use lean, we need virtuals
  // const mailingsPaginate  = Mailing
  // .find( filter )
  // .sort( sort )
  // .skip( pagination.page * pagination.limit )
  // .limit( pagination.limit )

  // const mailingsTotal = Mailing
  // .find( filter )
  // .lean()

  // // Extract used tags from mailings
  // // http://stackoverflow.com/questions/14617379/mongoose-mongodb-count-elements-in-array
  // const tagsList = Mailing
  // .aggregate( [
  //   { $match: {
  //      _group,
  //     tags:     { $exists: true },
  //   } },
  //   { $unwind: '$tags' },
  //   { $group: { _id: '$tags', } },
  //   { $sort:  { _id: 1 } }
  // ])

  // // tagsList.then(tags => console.log( tags.map( t => t._id ) ))

  // // gather informations for select boxes
  // const usersRequest      = isAdmin ? Promise.resolve(false)
  // : User.find( { _group: user._group }, '_id name').lean()

  // const templatesRequest  = isAdmin ? Template.find({}, '_id name').lean()
  // : Template.find( { _group: user._group }, '_id name').lean()


  // //----- GATHER ALL INFOS

  // Promise
  // .all( [
  //   mailingsPaginate,
  //   mailingsTotal,
  //   usersRequest,
  //   templatesRequest,
  //   tagsList
  // ] )
  // .then( ([paginated, filtered, users, templates, tags]) => {

  //   // PAGINATION STATUS

  //   const total         = filtered.length
  //   const isFirst       = pagination.start === 0
  //   const isLast        = pagination.page >= Math.trunc(total / perpage)
  //   pagination.total    = total
  //   pagination.current  = `${pagination.start + 1}-${pagination.start + paginated.length}`
  //   pagination.prev     = isFirst ? false : pagination.page
  //   pagination.next     = isLast  ? false : pagination.page + 2

  //   // SUMMARY STATUS

  //   // “translate” ids: need users & templates in order to compute
  //   let idToName = ['_user', '_template']
  //   idToName     = _.intersection( idToName, filterKeys )
  //   for (let key of idToName) {
  //     const dataList = key === '_user' ? users : templates
  //     filterQuery[ key ] = filterQuery[ key ].map( id => {
  //       return _.find( dataList, value => `${value._id}` === id ).name
  //     } )
  //   }

  //   // format for view
  //   const i18nKeys = {
  //     name:       'filter.summary.contain',
  //     _user:      'filter.summary.author',
  //     _template:  'filter.summary.template',
  //     createdAt:  'filter.summary.createdat',
  //     updatedAt:  'filter.summary.updatedat',
  //     tags:       'filter.summary.tags',
  //   }
  //   const summary   = []
  //   _.forIn( filterQuery, (value, key) => {
  //     let i18nKey = i18nKeys[ key ]
  //     if ( _.isString(value) ) return summary.push( { message: i18nKey, value} )
  //     if ( _.isArray(value) ) {
  //       return summary.push( { message: i18nKey, value: value.join(', ')} )
  //     }
  //     // dates…
  //     summary.push( { message: i18nKey } )
  //     if (value.$gte) {
  //       summary.push( {
  //         message: 'filter.summary.after',
  //         value:    value.$gte
  //       } )
  //     }
  //     if (value.$gte && value.$lte ) {
  //       summary.push( {
  //         message: 'filter.summary.and',
  //       } )
  //     }
  //     if (value.$lte) {
  //       summary.push( {
  //         message: 'filter.summary.before',
  //         value:    value.$lte
  //       } )
  //     }
  //   })

  //   // FINALLY RENDER \o/
  //   res.render('mailing-list', {
  //     data: {
  //       mailings:  paginated,
  //       tagsList:  tags.map( t => t._id ),
  //       pagination,
  //       filterQuery,
  //       users,
  //       templates,
  //       summary,
  //     }
  //   })
  // })
  // .catch(next)
}

//////
// EDITOR
//////

async function show(req, res, next) {
  const { isAdmin }     = req.user
  const { mailingId }   = req.params
  const data            = {
    translations: translations[ res.getLocale() ],
  }
  const reqParams       = {
    where: {
      id: mailingId,
    },
    include: [{
      model:    User,
      required: false,
    }, {
      model:    Template,
      required: false,
    }],
  }
  if ( !isAdmin ) reqParams.where.groupId = req.user.groupId
  const mailing         = await Mailing.findOne( reqParams )
  if ( !mailing ) return next( createError(404) )
  res.render('mailing-edit', {
    data: _.assign( {}, data, mailing.mosaico)
  })
}

//////
// NEW MAILING
//////

async function create(req, res, next) {
  const { isAdmin }     = req.user
  const { templateId }  = req.query
  const reqParams       = {
    where: {
      id: templateId,
    },
  }
  if ( !isAdmin ) reqParams.where.groupId = req.user.groupId
  const template        = await Template.findOne( reqParams )
  if ( !template ) return next( createError(404) )
  const initParameters  = {
    // Always give a default name: needed for ordering & filtering
    // use res.__ because (not req) it's where i18n is always up to date (index.js#192)
    name:         res.__('home.saved.noname'),
    templateId:   templateId,
  }
  // admin doesn't have valid user id & group
  if (!req.user.isAdmin) {
    initParameters.userId  = req.user.id
    initParameters.groupId = req.user.groupId
  }
  const mailing           = await Mailing.create( initParameters )
  res.redirect( mailing.url.update )
}

//////
// BULK ACTIONS
//////

function getRedirectUrl(req) {
  const query       = qs.stringify( _.omit(req.query, ['_method']) )
  const redirectUrl = query ? `/?${query}` : '/'
  return redirectUrl
}

function updateLabels(req, res, next) {
  const { body }    = req
  let { mailings } = body
  const tagRegex    = /^tag-/
  const redirectUrl = getRedirectUrl(req)
  if (!_.isArray( mailings ) || !mailings.length ) return res.redirect( redirectUrl )

  // Entries will be supported natively without flag in node 7+
  // use lodash for not bumping node version
  // http://node.green/#features
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
  let tags = _.entries( body )
  .filter( element => tagRegex.test( element[0] ) )
  .map( tag => {
    tag[0] = tag[0].replace(tagRegex, '')
    return tag
  } )

  Mailing
  .find( addStrictGroupFilter(req.user, {
    _id: {
      $in: mailings.map(Types.ObjectId),
    },
  }) )
  .then(onMailing)
  .catch(next)

  function onMailing(docs) {
    Promise
    .all( docs.map( updateTags ) )
    .then( onSave )
    .catch( next )
  }

  function updateTags(doc) {
    tags.forEach( tagAction => {
      const [tag, action] = tagAction
      if (action === 'unchange') return
      if (action === 'add')    doc.tags = _.union( doc.tags, [ tag ] )
      if (action === 'remove') doc.tags = _.without( doc.tags, tag )
    })
    doc.tags = doc.tags.sort().map( cleanTagName )
    return doc.save()
  }

  function onSave(docs) {
    res.redirect( redirectUrl )
  }
}

async function bulkRemove(req, res, next) {
  const { isAdmin }     = req.user
  const { mailings }    = req.body
  if (!_.isArray( mailings ) || !mailings.length ) return res.redirect( redirectUrl )
  const redirectUrl     = getRedirectUrl( req )
  const reqParams       = {
    where: {
      id: {
        $in: mailings,
      }
    }
  }
  if ( !isAdmin ) reqParams.where.groupId = req.user.groupId
  const deleted         = await Mailing.destroy( reqParams )
  res.redirect( redirectUrl )
}

//////
// OTHERS ACTIONS
//////

async function update(req, res, next) {
  if (!req.xhr) return next( createError(501) ) // Not Implemented

  const { isAdmin }     = req.user
  const { mailingId }   = req.params
  const reqParams       = {
    where: {
      id: mailingId,
    },
    include: [{
      model:    User,
      required: false,
    }, {
      model:    Template,
      required: false,
    }],
  }

  if ( !isAdmin ) reqParams.where.groupId = req.user.groupId
  const mailing        = await Mailing.findOne( reqParams )

  if (!mailing) return next( createError(404) )
  mailing.data = req.body.data || mailing.data
  // use res.__ because (not req) it's where i18n is always up to date (index.js#192)
  mailing.name = h.normalizeString( req.body.name ) || res.__('home.saved.noname')

  const updatedMailing = await mailing.save()
  res.json( updatedMailing.mosaico )
}

// TODO while duplicating we should copy only the used images by the mailing
function duplicate(req, res, next) {
  const { mailingId }    = req.params

  Promise
  .all([
    Mailing.findOne( addGroupFilter(req.user, { _id: mailingId }) ),
    Galleries.findOne( { mailingOrTemplateId: mailingId } ),
  ])
  // Be sure that all images are duplicated before saving the duplicated mailing
  .then( duplicateImages )
  .then( saveMailing )
  .then( redirectToHome )
  .catch( err => {
    if (err.responseSend) return
    next( err )
  } )

  function duplicateImages( [mailing, gallery] ) {
    if (!mailing) {
      next( createError(404) )
      // Early return out of the promise chain
      return Promise.reject( {responseSend: true} )
    }
    const duplicatedMailing = mailing.duplicate( req.user )
    return Promise.all([
      duplicatedMailing,
      gallery,
      filemanager.copyImages( req.params.mailingId, duplicatedMailing._id ),
    ])
  }

  function saveMailing( [duplicatedMailing, gallery] ) {
    return Promise.all( [duplicatedMailing.save(), gallery ])
  }

  function redirectToHome( [duplicatedMailing, gallery] ) {
    res.redirect('/')
    // if gallery can't be created it's not a problem
    // it will be created when opening the duplicated mailing
    // we only loose hidden images
    if ( gallery ) gallery.duplicate( duplicatedMailing._id ).save()
  }

}

module.exports = {
  userList:     h.asyncMiddleware( userList ),
  show:         h.asyncMiddleware( show ),
  update:       h.asyncMiddleware( update ),
  updateLabels,
  bulkRemove:   h.asyncMiddleware( bulkRemove ),
  create:       h.asyncMiddleware( create ),
  duplicate,
}
