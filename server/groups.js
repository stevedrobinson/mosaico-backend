'use strict'

const chalk                 = require('chalk')
const createError           = require('http-errors')

const config                = require('./config')
const { handleValidatorsErrors,
  Groups, Users,
  Templates, Mailings }   = require('./models')

function list(req, res, next) {
  Groups
  .find( {} )
  .sort({ createdAt: -1 })
  .then( groups => {
    return res.render('group-list', {
      data: { groups }
    })
  })
  .catch( next )
}

function show(req, res, next) {
  const { groupId } = req.params
  if (!groupId) return res.render('group-new-edit')
  const getGroup    = Groups.findById( groupId )
  const getUsers    = Users.find({
    _group:       groupId,
    isDeactivated:  { $ne: true },
  }).sort({ createdAt: -1 })
  const getTemplates = Templates.find({_group: groupId}).sort({ createdAt: -1 })
  const getMailings  = Mailings
  .find({_group: groupId, }, '_id name _user _template createdAt updatedAt')
  .populate('_user', '_id name email')
  .populate('_template', '_id name')
  .sort({ updatedAt: -1})

  Promise
  .all( [getGroup, getUsers, getTemplates, getMailings] )
  .then( ([group, users, templates, mailings]) => {
    if (!group) return next(createError(404))
    res.render('group-new-edit', {
      data: {
        group,
        users,
        templates,
        mailings,
      },
    })
  })
  .catch( next )
}

function update(req, res, next) {
  var groupId = req.params.groupId
  var dbRequest = groupId ?
    Groups.findByIdAndUpdate(groupId, req.body, {runValidators: true})
    : new Groups(req.body).save()

  dbRequest
  .then( group => res.redirect(`/groups/${group._id}`) )
  .catch(err => handleValidatorsErrors(err, req, res, next) )
}

module.exports = {
  list:       list,
  show:       show,
  update:     update,
}
