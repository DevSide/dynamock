import {
  createFixtureStorage,
  type FixtureStorageType,
  registerFixture,
  removeFixture,
  removeFixtures,
  validateFixture,
} from './fixtures.js'
import {
  type ConfigurationType,
  createConfiguration,
  updateConfiguration,
  validateConfiguration,
} from './configuration.js'

function createError(status: number, message: string): [number, object] {
  return [status, { message: `[FIXTURE SERVER ERROR ${status}]: ${message}` }]
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

export function getServiceConfiguration({ configuration }: ServiceType): [number, object] {
  return [200, configuration]
}

export function updateServiceConfiguration(
  { configuration }: ServiceType,
  data: Partial<ConfigurationType>,
): [number, object] {
  const error = validateConfiguration(data)

  if (error) {
    return createError(400, error.message)
  }

  const { cors, headers, query, cookies } = data
  updateConfiguration(configuration, cors, headers, query, cookies)

  return [200, configuration]
}

export function deleteConfiguration(service: ServiceType): [number] {
  service.configuration = createConfiguration()

  return [204]
}

export function createServiceFixture(
  { configuration, fixtureStorage }: ServiceType,
  unsafeFixture: unknown,
): [number, object] {
  const [fixture, validationError] = validateFixture(unsafeFixture, configuration)

  if (!fixture) {
    return createError(400, validationError)
  }

  const { conflictError, fixtureId } = registerFixture(fixtureStorage, fixture, configuration)

  if (conflictError) {
    return createError(409, conflictError)
  }
  return [201, { id: fixtureId }]
}

export function createServiceFixtures(
  { configuration, fixtureStorage }: ServiceType,
  unsafeFixtures: unknown[],
): [number, object] {
  const fixtureIds: { id: string }[] = []

  const cleanUpOnError = () => {
    for (const { id } of fixtureIds) {
      removeFixture(fixtureStorage, id)
    }
  }

  for (const unsafeFixture of unsafeFixtures) {
    const [fixture, validationError] = validateFixture(unsafeFixture, configuration)

    if (!fixture) {
      cleanUpOnError()

      return createError(400, validationError)
    }

    const { conflictError, fixtureId } = registerFixture(fixtureStorage, fixture, configuration)

    if (conflictError) {
      cleanUpOnError()

      return createError(409, conflictError)
    }

    fixtureIds.push({ id: fixtureId })
  }

  return [201, fixtureIds]
}

export function deleteServiceFixture({ fixtureStorage }: ServiceType, id: string): [number] {
  removeFixture(fixtureStorage, id)

  return [204]
}

export function deleteServiceFixtures({ fixtureStorage }: ServiceType): [number, object] {
  removeFixtures(fixtureStorage)

  return [204, {}]
}

export function hasServiceCors({ configuration }: ServiceType) {
  return configuration.cors === '*'
}
