const crypto = require('crypto')

exports.isArrayOrObject = function isArrayOrObject (value) {
  return typeof value === 'object'
}

exports.isObject = function isObject (value) {
  return typeof value === 'object' && !Array.isArray(value)
}

exports.sortObjectKeysRecurs = function sortObjectKeysRecurs (src) {
  if (Array.isArray(src)) {
    const out = []

    for (const item of src) {
      out.push(sortObjectKeysRecurs(item))
    }

    return out
  } else if (typeof src === 'object' && src !== null) {
    return Object.keys(src)
      .sort()
      .reduce((acc, curr) => {
        acc[curr] = sortObjectKeysRecurs(src[curr])
        return acc
      }, {})
  }

  return src
}

exports.hash = function hash (str) {
  return crypto
    .createHash('sha1')
    .update(str)
    .digest('hex')
}
