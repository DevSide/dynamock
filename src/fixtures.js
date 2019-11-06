const isEmpty = require('lodash/isEmpty')
const {
  hash,
  isArrayOrObject,
  isObject,
  sortObjectKeysRecurs
} = require('./utils')
const { REQUEST_PROPERTIES, RESPONSE_PROPERTIES } = require('./properties')
const querystring = require('querystring')

const fixtureStorage = new Map()

function validateFixture (fixture, configuration) {
  if (!isObject(fixture)) {
    return 'fixture should be an object.'
  }

  const { request, response } = fixture

  if (!isObject(request) || !isObject(response)) {
    return 'request and response should be objects.'
  }

  // Check request
  if (!request.path || !request.method) {
    return 'request.path and request.method should be defined.'
  }

  for (const property in request) {
    if (property === 'body' || property === 'path' || property === 'method') {
      continue
    }

    const propertyValue = request[property]

    if (!REQUEST_PROPERTIES.includes(property)) {
      return `request.${property} is not a known property.`
    }

    if (!isArrayOrObject(propertyValue)) {
      return `request.${property} should be an array or object.`
    }

    if (isEmpty(propertyValue)) {
      return `request.${property} should not be empty.`
    }

    if (Array.isArray(propertyValue)) {
      for (let i = 0; i < propertyValue.length; i++) {
        const item = propertyValue[i]

        if (typeof item === 'string') {
          if (configuration[property][item] === undefined) {
            return `request.${property}[${i}] is not in the configuration.`
          }
        } else if (isObject(item)) {
          if (isEmpty(item)) {
            return `request.${property}[${i}] should not be empty.`
          }
        } else {
          return `request.${property}[${i}] should be an object or a string.`
        }
      }
    }
  }

  // Check response
  if (response.body !== undefined && response.filepath !== undefined) {
    return 'response.body and response.filepath are exclusive.'
  }

  if (response.body === undefined && response.filepath === undefined) {
    return 'response.body or response.filepath should be defined.'
  }

  for (const property in response) {
    if (property === 'body') {
      continue
    }

    const propertyValue = response[property]

    if (property === 'filepath') {
      if (!propertyValue || typeof propertyValue !== 'string') {
        return 'response.filepath should be a string.'
      }

      continue
    }

    if (property === 'status') {
      if (!propertyValue || typeof propertyValue !== 'number') {
        return 'response.status should be a number.'
      }

      continue
    }

    if (!RESPONSE_PROPERTIES.includes(property)) {
      return `response.${property} is not a known property.`
    }

    if (!isArrayOrObject(propertyValue)) {
      return `response.${property} should be an array or object.`
    }

    if (isEmpty(propertyValue)) {
      return `response.${property} should not be empty.`
    }

    if (Array.isArray(propertyValue)) {
      for (let i = 0; i < propertyValue.length; i++) {
        const item = propertyValue[i]

        if (typeof item === 'string') {
          if (configuration[property][item] === undefined) {
            return `response.${property}[${i}] is not in the configuration.`
          }
        } else if (isObject(item)) {
          if (isEmpty(item)) {
            return `response.${property}[${i}] should not be empty.`
          }
        } else {
          return `response.${property}[${i}] should be an object or a string.`
        }
      }
    }
  }

  return ''
}

function normalizeFixture (fixture, configuration) {
  const request = sortObjectKeysRecurs(fixture.request)
  const response = fixture.response

  for (const property in request) {
    if (property === 'body') {
      continue
    }

    if (property === 'method') {
      request.method = request.method.toUpperCase()
      continue
    }

    if (property === 'path') {
      // extract query from path is needed and move it in query property
      const indexQueryString = request.path.indexOf('?')

      if (indexQueryString >= 0) {
        const path = request.path.substring(0, indexQueryString)
        const query = querystring.parse(
          request.path.substring(indexQueryString + 1)
        )

        request.path = path

        if (request.query) {
          Object.assign(request.query, query)
        } else {
          request.query = query
        }
      }
      continue
    }

    const propertyValue = request[property]

    if (Array.isArray(propertyValue)) {
      request[property] = propertyValue.reduce((acc, propertyItem) => {
        if (typeof propertyItem === 'string') {
          return Object.assign(acc, configuration[property][propertyItem])
        }

        return Object.assign(acc, propertyItem)
      }, {})
    }
  }

  for (const property in response) {
    if (property === 'body' || property === 'filepath') {
      continue
    }

    const propertyValue = response[property]

    if (Array.isArray(propertyValue)) {
      response[property] = propertyValue.reduce((acc, propertyItem) => {
        if (typeof propertyItem === 'string') {
          return Object.assign(acc, configuration[property][propertyItem])
        }

        return Object.assign(acc, propertyItem)
      }, {})
    }
  }

  return {
    request,
    response
  }
}

function createFixtureId (fixture) {
  return hash(JSON.stringify(fixture.request))
}

exports.registerFixture = function registerFixture (
  unsafeFixture,
  configuration
) {
  const error = validateFixture(unsafeFixture, configuration)

  if (error) {
    return {
      error,
      status: 400,
      fixtureId: ''
    }
  }

  const fixture = normalizeFixture(unsafeFixture, configuration)
  const fixtureId = createFixtureId(fixture)

  if (fixtureStorage.has(fixtureId)) {
    return {
      error: `Route ${fixture.request.method} ${fixture.request.path} is already registered`,
      status: 409,
      fixtureId
    }
  }

  fixtureStorage.set(fixtureId, fixture)

  return {
    error: '',
    status: 0,
    fixtureId
  }
}

exports.getFixtureIterator = function getFixtureIterator () {
  return fixtureStorage
}

exports.removeFixture = function removeFixture (fixtureId) {
  return fixtureStorage.delete(fixtureId)
}

exports.removeFixtures = function removeFixtures () {
  fixtureStorage.clear()
}
