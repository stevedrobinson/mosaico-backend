const createError           = require('http-errors')

const {
  Mailings,
  Users,
  addStrictGroupFilter,
}                         = require('./models')

function get(req, res, next) {
  const filter = addStrictGroupFilter(req.user, { _id: req.params.mailingId,} )

  Mailings
  .findOne( filter, '_template name' )
  .populate('_template', '_group')
  .then( onMailing )
  .catch( next )

  function onMailing(mailing) {
    mailing = mailing
    Users
    .find({
      _group:       mailing._template._group,
      isDeactivated:  { $ne: true },
    }, 'name email')
    .then( users => onUsers(mailing, users) )
    .catch( next )
  }

  function onUsers(mailing, users) {
    res.render('mailing-transfer', {
      data: { mailing, users },
    })
  }
}

function post(req, res, next) {
  const { userId }      = req.body
  const { mailingId }  = req.params
  const userQuery       = Users.findById(userId, 'name _group')
  const mailingQuery   = Mailings.findById(mailingId, 'name')

  Promise
  .all([userQuery, mailingQuery])
  .then( onQueries )
  .catch( next )

  function onQueries( [ user, mailing ] ) {
    if (!user || !mailing) return next( createError(404) )
    mailing._user    = user._id
    mailing.author   = user.name
    mailing._group = user._group

    mailing
    .save()
    .then( mailing => res.redirect('/') )
    .catch( next )
  }
}

module.exports = {
  get,
  post,
}
