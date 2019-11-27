const _isEqual = require('lodash/isEqual')
const { isIncluded } = require('./utils')

exports.REQUEST_PROPERTIES = ['headers', 'body', 'query', 'cookies']
exports.RESPONSE_PROPERTIES = ['headers', 'cookies', 'filepath', 'body']

exports.requestPropertyMatch = function requestPropertyMatch (
  request,
  match,
  property
) {
  let requestProperty = request[property]
  let matchProperty = match[property]
  const optionsProperty = (match.options && match.options[property]) || {}

  if (optionsProperty.strict) {
    if (property !== 'body') {
      matchProperty = matchProperty || {}
      requestProperty = requestProperty || {}
    }

    return _isEqual(matchProperty, requestProperty)
  }

  if (!matchProperty && property !== 'body') {
    return true
  }

  return isIncluded(
    matchProperty,
    requestProperty,
    !!optionsProperty.allowRegex
  )
}

exports.useResponseProperties = {
  filepath: (req, res, value) => res.sendFile(value),
  headers: (req, res, value) => res.set(value),
  body: (req, res, value) => res.send(value),
  cookies: (req, res, cookies) => {
    for (const key in cookies) {
      res.cookie(key, cookies[key])
    }
  }
}
