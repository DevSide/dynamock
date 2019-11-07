const _transform = require('lodash/transform')
const _isEqual = require('lodash/isEqual')
const _isObject = require('lodash/isObject')
const _isEmpty = require('lodash/isEmpty')

function difference (object, base) {
  function changes (object, base) {
    return _transform(object, function (result, value, key) {
      if (!_isEqual(value, base[key])) {
        result[key] =
          _isObject(value) && _isObject(base[key])
            ? changes(value, base[key])
            : value

        if (_isObject(result[key]) && _isEmpty(result[key])) {
          delete result[key]
        } else if (_isEmpty(result[key])) {
          result[key] = null
        }
      }
    })
  }
  return changes(object, base)
}
exports.REQUEST_PROPERTIES = ['headers', 'body', 'query', 'cookies']
exports.RESPONSE_PROPERTIES = ['headers', 'cookies', 'filepath', 'body']

exports.doesPropertyMatch = function doesPropertyMatch (
  request,
  match,
  property,
  options = { strict: false }
) {
  const requestProperty = request[property] || {}
  const matchProperty = match[property] || {}

  if (options.strict) {
    return _isEqual(requestProperty, matchProperty)
  }

  const diff = difference(matchProperty, requestProperty)

  return _isEmpty(diff)
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
