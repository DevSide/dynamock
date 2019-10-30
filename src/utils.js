const crypto = require('crypto')

exports.isObjectEmpty = function isObjectEmpty (obj) {
  for (const key in obj) {
    if (Object.hasOwnProperty.call(obj, key)) {
      return false
    }
  }

  return true
}

exports.setFnName = function setFnName (fn, name) {
  Object.defineProperty(fn, 'name', { value: name, configurable: true })

  return fn
}

exports.sortObjectKeys = function sortObjectKeys (obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, curr) => {
      acc[curr] = obj[curr]
      return acc
    }, {})
}

exports.hash = function hash (str) {
  return crypto
    .createHash('sha1')
    .update(str)
    .digest('hex')
}
