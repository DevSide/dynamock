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
