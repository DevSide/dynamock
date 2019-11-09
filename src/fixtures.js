const { hash, sortObjectKeysRecurs } = require('./utils')
const querystring = require('querystring')
const Joi = require('@hapi/joi')
const fixtureStorage = new Map()

function validateFixture (fixture, configuration) {
  const schemaProperty = Joi.alternatives([
    Joi.array().items(
      Joi.custom((value, helpers) => {
        const path = helpers.state.path
        const property = path[path.length - 2]

        if (!configuration[property][value]) {
          throw new Error(`${value} not found in configuration`)
        }

        return value
      }),
      Joi.object()
    ),
    Joi.object()
  ])

  // TODO: move schema outside the func
  const schema = Joi.object({
    request: Joi.object({
      body: Joi.any(),
      path: Joi.string().required(),
      method: Joi.string().required(),
      headers: schemaProperty,
      cookies: schemaProperty,
      query: schemaProperty,
      options: Joi.object({
        headers: Joi.object({
          strict: Joi.bool()
        }),
        cookies: Joi.object({
          strict: Joi.bool()
        }),
        query: Joi.object({
          strict: Joi.bool()
        })
      })
    }).required(),
    response: Joi.object({
      status: Joi.number(),
      body: Joi.any(),
      filepath: Joi.string(),
      headers: schemaProperty,
      cookies: schemaProperty,
      options: Joi.object({
        delay: Joi.number()
      })
    })
      .or('body', 'filepath')
      .required()
  }).required()

  return schema.validate(fixture).error
}

function normalizeFixture (fixture, configuration) {
  const request = sortObjectKeysRecurs(fixture.request)
  const response = sortObjectKeysRecurs(fixture.response)
  const options = fixture.options

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

  if (options) {
    return { request, response, options }
  }

  return { request, response }
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
      error: error.message,
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
