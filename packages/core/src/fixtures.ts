import { URLSearchParams } from 'node:url'
import { hash, isObjectEmpty, type NonEmptyArray, sortObjectKeysRecurs } from './utils.js'
// TODO: remove Joi with a lightweight composable validation library
import Joi from '@hapi/joi'
import type { ConfigurationType } from './configuration.js'

export type FixtureStorageType = {
  storage: Map<string, NormalizedFixtureType>
}

export type FixtureRequestOptionsType = null | {
  // TODO: test and document this
  origin?: {
    allowRegex?: boolean
  }
  path?: {
    allowRegex?: boolean
    disableEncodeURI?: boolean
  }
  method?: {
    allowRegex?: boolean
  }
  headers?: {
    strict?: boolean
    allowRegex?: boolean
  }
  cookies?: {
    strict?: boolean
    allowRegex?: boolean
  }
  query?: {
    strict?: boolean
    allowRegex?: boolean
  }
  body?: {
    strict?: boolean
    allowRegex?: boolean
  }
}

export type FixtureRequestType = {
  origin: string
  path: string
  method: string
  headers?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  cookies?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  query?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  body?: null | { [key: string]: unknown }
  options?: FixtureRequestOptionsType
}

export type FixtureResponseType = {
  status?: number
  headers?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  cookies?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  query?: null | { [key: string]: string } | ({ [key: string]: string } | string)[]
  body?: null | { [key: string]: unknown }
  filepath?: string
  options?: null | {
    delay?: number
    lifetime?: number
  }
}

export type FixtureType =
  | {
      request: FixtureRequestType
      response: FixtureResponseType
    }
  | {
      request: FixtureRequestType
      responses: NonEmptyArray<FixtureResponseType>
    }

export type NormalizedFixtureRequestType = {
  origin: string
  path: string
  method: string
  headers?: null | { [key: string]: string }
  cookies?: null | { [key: string]: string }
  query?: null | { [key: string]: string }
  body?: null | { [key: string]: unknown }
  options?: FixtureRequestOptionsType
}

export type NormalizedFixtureResponseType = {
  status?: number
  headers?: null | { [key: string]: string }
  cookies?: null | { [key: string]: string }
  query?: null | { [key: string]: string }
  body?: null | { [key: string]: unknown }
  filepath?: string
  options?: null | {
    delay?: number
    lifetime?: number
  }
}

export type NormalizedFixtureType = {
  request: NormalizedFixtureRequestType
  responses: NonEmptyArray<NormalizedFixtureResponseType>
}

export function createFixtureStorage() {
  return {
    storage: new Map<string, NormalizedFixtureType>(),
  }
}

export function validateFixture(
  unsafeFixture: unknown,
  configuration: ConfigurationType,
): [null, string] | [FixtureType, string] {
  const schemaProperty = Joi.alternatives([
    Joi.array().items(
      Joi.custom((value, helpers) => {
        const path = helpers.state.path
        const property = path?.[path.length - 2]

        if (property === 'headers' || property === 'query' || property === 'cookies') {
          if (!configuration[property]?.[value]) {
            throw new Error(`${value} not found in configuration`)
          }
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
    origin: Joi.string().required(),
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
        disableEncodeURI: Joi.bool(),
      }).invalid({ allowRegex: true, disableEncodeURI: true }),
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
  }).oxor('body', 'filepath')

  const schema = Joi.object({
    request: requestSchema.required(),
    response: responseSchema,
    responses: Joi.array().items(responseSchema),
  })
    .or('response', 'responses')
    .required()

  const error = schema.validate(unsafeFixture).error

  if (error) {
    return [null, error.message]
  }

  // Use "as" temporarily until new validation lib like Zod
  return [unsafeFixture as FixtureType, '']
}

function normalizeArrayMatcher(
  property: 'headers' | 'cookies' | 'query',
  propertyValue: ({ [key: string]: string } | string)[],
  configuration: ConfigurationType,
) {
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

function normalizePath(request: FixtureRequestType) {
  // extract query from path is needed and move it in query property
  const indexQueryString = request.path.indexOf('?')

  if (indexQueryString >= 0) {
    const path = request.path.substring(0, indexQueryString)
    const searchParams = new URLSearchParams(request.path.substring(indexQueryString + 1))
    const query = Object.fromEntries(searchParams.entries())

    request.path = path

    if (request.query) {
      Object.assign(request.query, query)
    } else {
      request.query = query
    }
  }

  const pathOptions = request.options?.path

  if (!pathOptions || (!pathOptions.allowRegex && !pathOptions.disableEncodeURI)) {
    request.path = encodeURI(request.path)
  }
}

function normalizeFixture(fixture: FixtureType, configuration: ConfigurationType): NormalizedFixtureType {
  const request = sortObjectKeysRecurs(fixture.request) as FixtureRequestType
  const responses = sortObjectKeysRecurs(
    'response' in fixture ? [fixture.response] : fixture.responses,
  ) as NonEmptyArray<FixtureResponseType>

  for (const property in request) {
    if (property === 'body') {
      continue
    }

    if (property === 'method') {
      request.method = request.method.toUpperCase()
      continue
    }

    if (property === 'url' || property === 'path') {
      normalizePath(request)
      continue
    }

    if (property === 'headers' || property === 'cookies' || property === 'query') {
      const propertyValue = request[property]

      if (Array.isArray(propertyValue)) {
        request[property] = normalizeArrayMatcher(property, propertyValue, configuration)
      }

      if (typeof propertyValue === 'object' && isObjectEmpty(propertyValue)) {
        delete request[property]
      }
    }

    // RFC 2616
    if (property === 'headers') {
      const headers = request[property] as { [key: string]: string }

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
      const requestProperty = request[property] as { [key: string]: string }

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

      if (property === 'headers' || property === 'cookies' || property === 'query') {
        const propertyValue = response[property]

        if (Array.isArray(propertyValue)) {
          response[property] = normalizeArrayMatcher(property, propertyValue, configuration)
        }
      }
    }
  }

  return {
    request: request as NormalizedFixtureRequestType,
    responses: responses as NonEmptyArray<NormalizedFixtureResponseType>,
  }
}

function createFixtureId(fixture: FixtureType) {
  return hash(JSON.stringify(fixture.request))
}

export function registerFixture(
  { storage }: FixtureStorageType,
  newFixture: FixtureType,
  configuration: ConfigurationType,
) {
  const fixture = normalizeFixture(newFixture, configuration)
  const fixtureId = createFixtureId(fixture)

  if (storage.has(fixtureId)) {
    return {
      conflictError: `Route ${fixture.request.method} ${fixture.request.path} is already registered`,
      fixtureId,
    }
  }

  storage.set(fixtureId, fixture)

  return {
    conflictError: '',
    fixtureId,
  }
}

export function getFixtureIterator({ storage }: FixtureStorageType) {
  return storage
}

export function removeFixture({ storage }: FixtureStorageType, fixtureId: string) {
  return storage.delete(fixtureId)
}

export function removeFixtures({ storage }: FixtureStorageType) {
  storage.clear()
}
