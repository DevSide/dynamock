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
    // because array is a valid response, need to change the array form to another
    if (property === 'body') {
      return {
        error: '',
        values: matchProperties
      }
    }

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
  filePaths: () => {
    throw new Error('not implemented')
  },
  headers: (res, value) => res.set(value),
  body: (res, value) => res.send(value),
  cookies: (res, value) =>
    Object.entries(value).forEach((r, pair) => {
      res.cookie(...pair)
    })
}
