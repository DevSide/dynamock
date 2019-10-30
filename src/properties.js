const send = require('send')

exports.REQUEST_PROPERTIES = ['headers', 'params', 'body', 'query', 'cookies']
exports.RESPONSE_PROPERTIES = ['headers', 'body', 'cookies', 'filepath']

exports.doesPropertyMatch = function doesPropertyMatch (
  request,
  match,
  property
) {
  const requestProperty = request[property] || {}
  const matchProperty = match[property] || {}

  return Object.keys(matchProperty).every(
    key =>
      String(matchProperty[key]).toLowerCase() ===
      String(requestProperty[key]).toLowerCase()
  )
}

exports.resolveProperty = function resolveProperty (
  configuration,
  matchProperties,
  property
) {
  const values = {}

  if (matchProperties) {
    // body can't use the array form to extract configuration
    // we can't make a difference between array response and array using configuration
    if (property === 'body' || property === 'filepath') {
      return {
        error: '',
        values: matchProperties
      }
    }

    // TODO: handle configuration.routes
    if (Array.isArray(matchProperties)) {
      for (const matchProperty of matchProperties) {
        if (typeof matchProperty === 'string') {
          const fromConfig = configuration[property][matchProperty]

          if (!fromConfig) {
            return {
              error: `${property} group named ${matchProperty} is not in the configuration`,
              values: null
            }
          }

          Object.assign(values, fromConfig)
        } else if (
          !Array.isArray(matchProperty) &&
          typeof matchProperty === 'object'
        ) {
          Object.assign(values, matchProperty)
        } else {
          return {
            error: `${property} "${matchProperty}" should be an object or a configuration header group name.`,
            values: null
          }
        }
      }
    } else if (typeof matchProperties === 'object') {
      Object.assign(values, matchProperties)
    } else {
      return {
        error: `${property} should be an array or an object.`,
        values: null
      }
    }
  }

  return {
    error: '',
    values
  }
}

exports.useResponseProperties = {
  filepath: (req, res, value) => {
    send(req, value).pipe(res)
  },
  headers: (req, res, value) => res.set(value),
  body: (req, res, value) => res.send(value),
  cookies: (req, res, value) =>
    Object.entries(value).forEach((r, pair) => {
      res.cookie(...pair)
    })
}
