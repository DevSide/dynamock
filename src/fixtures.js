import { hash, isObjectEmpty, sortObjectKeysRecurs } from './utils'
import querystring from 'node:querystring'
// TODO: remove Joi with a lightweight composable validation library
import Joi from '@hapi/joi'

const fixtureStorage = new Map()

export function validateFixture(unsafeFixture, configuration) {
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
      Joi.object(),
    ),
    Joi.object(),
  ])

  const optionsStrictOrAllowRegex = Joi.object({
    strict: Joi.bool(),
    allowRegex: Joi.bool(),
  }).invalid({ strict: true, allowRegex: true })

  const requestSchema = Joi.object({
    body: Joi.any(),
    path: Joi.string().required(),
    method: Joi.alternatives([
      Joi.string().regex(/^(head|delete|put|post|get|options|patch|\*)$/i),
      Joi.custom((value, helpers) => {
        const options = helpers.state.ancestors[0].options || {}
        const allowMethodRegex = options.method?.allowRegex

        if (!allowMethodRegex) {
          throw new Error(`Method ${value} is not a valid method`)
        }

        if (typeof value !== 'string') {
          return helpers.error('string.invalid')
        }

        return value
      }),
    ]).required(),
    headers: schemaProperty,
    cookies: schemaProperty,
    query: schemaProperty,
    options: Joi.object({
      path: Joi.object({
        allowRegex: Joi.bool(),
      }),
      method: Joi.object({
        allowRegex: Joi.bool(),
      }),
      headers: optionsStrictOrAllowRegex,
      cookies: optionsStrictOrAllowRegex,
      query: optionsStrictOrAllowRegex,
      body: optionsStrictOrAllowRegex,
    }),
  })

  const responseSchema = Joi.object({
    status: Joi.number().integer().min(200).max(600),
    body: Joi.any(),
    filepath: Joi.string(),
    headers: schemaProperty,
    cookies: schemaProperty,
    options: Joi.object({
      delay: Joi.number().integer().min(0),
      lifetime: Joi.number().integer().min(0),
    }),
  }).or('body', 'filepath')

  const schema = Joi.object({
    request: requestSchema.required(),
    response: responseSchema,
    responses: Joi.array().items(responseSchema),
  })
    .or('response', 'responses')
    .required()

  const error = schema.validate(unsafeFixture).error

  if (error) {
    return error.message
  }

  return ''
}

function normalizeArrayMatcher(property, propertyValue, configuration) {
  const result = {}

  // Merge with configuration
  for (const propertyItem of propertyValue) {
    if (typeof propertyItem === 'string') {
      Object.assign(result, configuration[property][propertyItem])
    } else {
      Object.assign(result, propertyItem)
    }
  }

  return result
}

function normalizePath(request) {
  // extract query from path is needed and move it in query property
  const indexQueryString = request.path.indexOf('?')

  if (indexQueryString >= 0) {
    const path = request.path.substring(0, indexQueryString)
    const query = querystring.parse(request.path.substring(indexQueryString + 1))

    request.path = path

    if (request.query) {
      Object.assign(request.query, query)
    } else {
      request.query = query
    }
  }
}

function normalizeFixture(fixture, configuration) {
  const request = sortObjectKeysRecurs(fixture.request)
  const responses = sortObjectKeysRecurs(fixture.responses || [fixture.response])

  for (const property in request) {
    if (property === 'body') {
      continue
    }

    if (property === 'method') {
      request.method = request.method.toUpperCase()
      continue
    }

    if (property === 'path') {
      normalizePath(request)
      continue
    }

    const propertyValue = request[property]

    if (Array.isArray(propertyValue)) {
      request[property] = normalizeArrayMatcher(property, propertyValue, configuration)
    }

    if (typeof propertyValue === 'object' && isObjectEmpty(propertyValue)) {
      delete request[property]
    }

    // RFC 2616
    if (property === 'headers') {
      const headers = request[property]

      for (const key in headers) {
        const lowerCaseKey = key.toLowerCase()

        if (key !== lowerCaseKey) {
          headers[lowerCaseKey] = headers[key]
          delete headers[key]
        }
      }
    }

    // Some properties only manipulates string values
    if (property === 'headers' || property === 'cookies' || property === 'query') {
      const requestProperty = request[property]

      for (const key in requestProperty) {
        if (typeof requestProperty[key] !== 'string') {
          requestProperty[key] = JSON.stringify(requestProperty[key])
        }
      }
    }
  }

  for (const response of responses) {
    for (const property in response) {
      if (property === 'body' || property === 'filepath') {
        continue
      }

      const propertyValue = response[property]

      if (Array.isArray(propertyValue)) {
        response[property] = normalizeArrayMatcher(property, propertyValue, configuration)
      }
    }
  }

  return { request, responses }
}

function createFixtureId(fixture) {
  return hash(JSON.stringify(fixture.request))
}

export function registerFixture(newFixture, configuration) {
  const fixture = normalizeFixture(newFixture, configuration)
  const fixtureId = createFixtureId(fixture)

  if (fixtureStorage.has(fixtureId)) {
    return {
      conflictError: `Route ${fixture.request.method} ${fixture.request.path} is already registered`,
      fixtureId,
    }
  }

  fixtureStorage.set(fixtureId, fixture)

  return {
    conflictError: '',
    fixtureId,
  }
}

export function getFixtureIterator() {
  return fixtureStorage
}

export function removeFixture(fixtureId) {
  return fixtureStorage.delete(fixtureId)
}

export function removeFixtures() {
  fixtureStorage.clear()
}
