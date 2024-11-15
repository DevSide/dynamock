import { URLSearchParams } from 'node:url'
import { hash, isObjectEmpty, type NonEmptyArray, sortObjectKeysRecurs } from './utils.js'
import type { ConfigurationType } from './configuration.js'
import type { z } from 'zod'
import {
  type FixtureRequestOptionsSchema,
  type FixtureRequestSchema,
  type FixtureResponseSchema,
  FixtureSchema,
} from './schema.js'

export type FixtureStorageType = {
  storage: Map<string, NormalizedFixtureType>
}

export type FixtureRequestOptionsType = null | z.infer<typeof FixtureRequestOptionsSchema>
export type FixtureRequestType = z.infer<typeof FixtureRequestSchema>
export type FixtureResponseType = z.infer<typeof FixtureResponseSchema>
export type FixtureType = z.infer<typeof FixtureSchema>

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

export function validateFixture(unsafeFixture: unknown, configuration: ConfigurationType) {
  const refineArrayWithConfiguration = (
    property: 'headers' | 'query' | 'cookies',
  ): [(data: FixtureType) => boolean | true, { message: string }] => [
    (data: FixtureType) => {
      const propertyValue = data.request[property]

      if (Array.isArray(propertyValue)) {
        return propertyValue.every((value) =>
          typeof value === 'string' ? configuration[property][value] !== undefined : true,
        )
      }

      return true
    },
    {
      message: `request.${property} contains a value not in the configuration`,
    },
  ]

  return FixtureSchema.refine(...refineArrayWithConfiguration('headers'))
    .refine(...refineArrayWithConfiguration('query'))
    .refine(...refineArrayWithConfiguration('cookies'))
    .safeParse(unsafeFixture)
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

    if (Array.isArray(request.query)) {
      request.query.push(query)
    } else if (request.query) {
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

function createFixtureId(fixture: NormalizedFixtureType) {
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
