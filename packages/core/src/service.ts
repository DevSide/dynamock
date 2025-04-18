import {
  createFixtureStorage,
  type FixtureStorageType,
  getFixtureIterator,
  registerFixture,
  removeFixture,
  removeFixtures,
  validateFixture,
} from './fixtures.js'
import {
  ConfigurationPartialType,
  type ConfigurationType,
  createConfiguration,
  updateConfiguration,
  validateConfiguration,
} from './configuration.js'
import { REQUEST_PROPERTIES, requestPropertyMatch } from './properties.js'
import type { CoreRequest } from './request.js'
import type { CoreResponse } from './response.js'
import type { ZodError } from 'zod'

export function createServiceError(
  status: number,
  message: string,
  error: null | ZodError<unknown> = null,
): [number, { message: string; error: null | ZodError<unknown> }] {
  return [
    status,
    {
      message: `[FIXTURE SERVER ERROR ${status}]: ${message}`,
      error,
    },
  ]
}

export type ServiceType = {
  configuration: ConfigurationType
  fixtureStorage: FixtureStorageType
}

export function createService() {
  return {
    configuration: createConfiguration(),
    fixtureStorage: createFixtureStorage(),
  }
}

export function resetService(service: ServiceType) {
  service.configuration = createConfiguration()
  service.fixtureStorage = createFixtureStorage()
}

export function getServiceConfiguration({ configuration }: ServiceType): [number, ConfigurationType] {
  return [200, configuration]
}

export function updateServiceConfiguration(
  { configuration }: ServiceType,
  data: unknown,
): [number, ConfigurationType | { message: string }] {
  const validation = validateConfiguration(data)

  if (!validation.success) {
    return createServiceError(400, 'Configuration validation failed', validation.error)
  }

  const { cors, headers, query, cookies } = validation.data
  updateConfiguration(configuration, cors, headers, query, cookies)

  return [200, configuration]
}

export function deleteServiceConfiguration(service: ServiceType): [number] {
  service.configuration = createConfiguration()

  return [204]
}

export function createServiceFixture(
  { configuration, fixtureStorage }: ServiceType,
  unsafeFixture: unknown,
): [number, object] {
  const validation = validateFixture(unsafeFixture, configuration)

  if (!validation.success) {
    return createServiceError(400, 'Fixture validation failed', validation.error)
  }

  const { conflictError, fixtureId } = registerFixture(fixtureStorage, validation.data, configuration)

  if (conflictError) {
    return createServiceError(409, conflictError)
  }
  return [201, { id: fixtureId }]
}

export function createServiceFixtures(
  { configuration, fixtureStorage }: ServiceType,
  unsafeFixtures: unknown,
): [number, object] {
  const fixtureIds: { id: string }[] = []

  if (!Array.isArray(unsafeFixtures)) {
    return createServiceError(400, 'Fixtures should be an array')
  }

  const cleanUpOnError = () => {
    for (const { id } of fixtureIds) {
      removeFixture(fixtureStorage, id)
    }
  }

  for (const unsafeFixture of unsafeFixtures) {
    const validation = validateFixture(unsafeFixture, configuration)

    if (!validation.success) {
      cleanUpOnError()

      return createServiceError(400, 'Fixture validation failed', validation.error)
    }

    const { conflictError, fixtureId } = registerFixture(fixtureStorage, validation.data, configuration)

    if (conflictError) {
      cleanUpOnError()

      return createServiceError(409, conflictError)
    }

    fixtureIds.push({ id: fixtureId })
  }

  return [201, fixtureIds]
}

export function deleteServiceFixture({ fixtureStorage }: ServiceType, id: unknown): [number, object] {
  if (typeof id !== 'string') {
    return createServiceError(400, 'fixture id should be a string')
  }

  removeFixture(fixtureStorage, id)

  return [204, {}]
}

export function deleteServiceFixtures({ fixtureStorage }: ServiceType): [number, object] {
  removeFixtures(fixtureStorage)

  return [204, {}]
}

export function hasServiceCors({ configuration }: ServiceType) {
  return configuration.cors === '*'
}

const corsAllowAllHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
}

export function matchServiceRequestAgainstFixtures(
  service: ServiceType,
  coreRequest: CoreRequest,
  end: (coreResponse: CoreResponse) => void,
): boolean {
  if (coreRequest.method === 'OPTIONS' && hasServiceCors(service)) {
    end({
      status: 200,
      headers: corsAllowAllHeaders,
      cookies: {},
      query: {},
      body: undefined,
      filepath: '',
    })

    return true
  }

  fixtureLoop: for (const [fixtureId, fixture] of getFixtureIterator(service.fixtureStorage)) {
    const { request: fixtureRequest, responses } = fixture

    if (
      !requestPropertyMatch(coreRequest, fixtureRequest, 'origin') ||
      !requestPropertyMatch(coreRequest, fixtureRequest, 'path') ||
      !requestPropertyMatch(coreRequest, fixtureRequest, 'method')
    ) {
      continue
    }

    for (const property of REQUEST_PROPERTIES) {
      if (!requestPropertyMatch(coreRequest, fixtureRequest, property)) {
        continue fixtureLoop
      }
    }

    const response = responses[0]
    const options = response.options || {}

    const send = () => {
      const coreResponse = {
        status: response.status || 200, // TODO not here
        headers: response.headers ?? {},
        cookies: response.cookies ?? {},
        query: response.query ?? {},
        body: response.body,
        filepath: response.filepath ?? '',
      }

      if (hasServiceCors(service)) {
        Object.assign(coreResponse.headers, corsAllowAllHeaders)
      }

      end(coreResponse)
    }

    // The fixture has been or will be consumed
    // When the response is delayed, we need to remove it before it returns
    if (options.lifetime === undefined || options.lifetime === 1) {
      if (responses.length > 1) {
        responses.shift()
      } else {
        removeFixture(service.fixtureStorage, fixtureId)
      }
    } else if (options.lifetime > 0) {
      options.lifetime--
    }

    if (response.options?.delay) {
      setTimeout(send, response.options.delay)
    } else {
      send()
    }

    return true
  }

  return false
}
