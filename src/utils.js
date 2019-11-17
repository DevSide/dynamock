const crypto = require('crypto')
const _isEqual = require('lodash/isEqual')

exports.isObjectEmpty = isObjectEmpty
function isObjectEmpty (object) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) return false
  }
  return true
}

function isObject (object) {
  return typeof object === 'object' && !Array.isArray(object)
}

exports.isIncluded = function isIncluded (object, base) {
  function _isIncluded (object, base) {
    for (const key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) {
        continue
      }

      const value = object[key]
      const baseValue = base[key]

      if (isObject(value) && value !== null) {
        if (isObjectEmpty(value)) {
          continue
        }

        if (isObject(baseValue) && _isIncluded(value, baseValue)) {
          continue
        }
      }

      if (_isEqual(value, baseValue)) {
        continue
      }

      return false
    }

    return true
  }

  return _isIncluded(object, base)
}

exports.sortObjectKeysRecurs = function sortObjectKeysRecurs (src) {
  if (Array.isArray(src)) {
    const out = []

    for (const item of src) {
      out.push(sortObjectKeysRecurs(item))
    }

    return out
  }

  if (typeof src === 'object' && src !== null) {
    const out = {}
    const sortedKeys = Object.keys(src).sort()

    for (const key of sortedKeys) {
      out[key] = sortObjectKeysRecurs(src[key])
    }

    return out
  }

  return src
}

exports.hash = function hash (str) {
  return crypto
    .createHash('sha1')
    .update(str)
    .digest('hex')
}
