const crypto = require('crypto')
const { deepStrictEqual } = require('assert')

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

const stringRegexp = /\/(.*)\/([gimuys]*)/

function matchRegex (value, baseValue) {
  const matchRegExp = value.match(stringRegexp)

  if (matchRegExp) {
    const [, regexp, flags] = matchRegExp

    if (new RegExp(regexp, flags).test(baseValue)) {
      return true
    }
  }

  return false
}

exports.matchRegex = matchRegex

exports.isIncluded = function isIncluded (object, base, allowRegex) {
  function _isIncluded (object, base) {
    for (const key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) {
        continue
      }

      const value = object[key]
      const baseValue = base[key]

      if (isObject(value) && value !== null) {
        if (isObject(baseValue) && _isIncluded(value, baseValue, allowRegex)) {
          continue
        }
      }

      if (
        allowRegex &&
        typeof value === 'string' &&
        typeof baseValue === 'string' &&
        matchRegex(value, baseValue)
      ) {
        continue
      }

      try {
        deepStrictEqual(value, baseValue)
        continue
      } catch (_) {}

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
