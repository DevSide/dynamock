const _isEqual = require('lodash/isEqual')
const { isIncluded } = require('./utils')

exports.REQUEST_PROPERTIES = ['headers', 'body', 'query', 'cookies']
exports.RESPONSE_PROPERTIES = ['headers', 'cookies', 'filepath', 'body']

exports.doesPropertyMatch = function doesPropertyMatch (
  request,
  match,
  property
) {
  const requestProperty = request[property] || {}
  const matchProperty = match[property] || {}

  if (
    match.options &&
    match.options[property] &&
    match.options[property].strict
  ) {
    return _isEqual(requestProperty, matchProperty)
  }

  return isIncluded(matchProperty, requestProperty)
}

exports.useResponseProperties = {
  filepath: (req, res, value) => {
    res.sendFile(value)
    // send(req, value).pipe(res)
  },
  headers: (req, res, value) => res.set(value),
  body: (req, res, value) => res.send(value),
  cookies: (req, res, value) =>
    Object.entries(value).forEach((r, pair) => {
      res.cookie(...pair)
    })
}
