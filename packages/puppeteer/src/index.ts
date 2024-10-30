import type { HTTPRequest, Page } from 'puppeteer'
import {
  type CoreRequest,
  type CoreResponse,
  createService,
  createServiceFixtures,
  deleteServiceConfiguration,
  deleteServiceFixture,
  deleteServiceFixtures,
  createServiceError,
  type FixtureRequestType,
  type FixtureResponseType,
  type FixtureType,
  matchServiceRequestAgainstFixtures,
  resetService,
  updateServiceConfiguration,
} from '@dynamock/core'
import { URLSearchParams } from 'node:url'
import type { ConfigurationType } from '@dynamock/core/dist/configuration.js'
import { URL } from 'node:url'

function mapToCoreRequest(request: HTTPRequest): CoreRequest {
  const headers = request.headers()
  const postData = request.postData()
  let body = undefined

  if (postData !== undefined) {
    const contentType = headers['content-type'] || ''

    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(postData)
      } catch (error) {
        body = undefined
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const searchParams = new URLSearchParams(postData)
      body = Object.fromEntries(searchParams.entries())
    }
  }

  const parsedUrl = new URL(request.url())

  const { cookie: cookieHeader, ...headersWithoutCookie } = headers

  const cookies = cookieHeader
    ? Object.fromEntries(
        cookieHeader.split('; ').map((cookie) => {
          const [key, value] = cookie.split('=')
          return [decodeURIComponent(key), decodeURIComponent(value)]
        }),
      )
    : {}

  return {
    origin: parsedUrl.origin,
    path: parsedUrl.pathname,
    method: request.method(),
    body,
    headers: headersWithoutCookie,
    cookies,
    query: Object.entries(parsedUrl.searchParams).reduce<{ [key in string]: string }>((acc, [key, value]) => {
      if (value) {
        if (typeof value === 'string') {
          acc[key] = value
        }
      }

      return acc
    }, {}),
  }
}

function mapToFixtureType(fixture: FixturePuppeteerType): FixtureType {
  const url = fixture.request.url
  let origin = ''
  let path = ''

  try {
    const parsedUrl = new URL(url)
    origin = parsedUrl.origin
    path = parsedUrl.toString().replace(parsedUrl.origin, '')
  } catch (error) {
    if (url.endsWith('*')) {
      const parsedUrl = new URL(url.slice(0, -1))
      origin = parsedUrl.origin
      path = '*'
    }
  }
  const { url: remove, ...request } = fixture.request

  return {
    ...fixture,
    request: {
      ...request,
      origin,
      path,
    },
  }
}

export type FixturePuppeteerType = {
  request: Omit<FixtureRequestType, 'path' | 'origin'> & {
    url: string
  }
  response: FixtureResponseType
}

const service = createService()
let initialized = false

async function initializeInterceptor(page: Page) {
  await page.setRequestInterception(true)

  page.on('request', async (request) => {
    if (request.isInterceptResolutionHandled()) return

    const coreRequest = mapToCoreRequest(request)

    await new Promise((resolve) => {
      const didMatch = matchServiceRequestAgainstFixtures(service, coreRequest, (coreResponse: CoreResponse) => {
        // TODO: filepath exclude
        // TODO: need to computer cookies with coreResponse.cookies
        // TODO: body should be string|undefined in CoreResponse, already parsed
        const contentType = coreResponse.headers['content-type'] ?? ''

        request.respond({
          status: coreResponse.status,
          headers: coreResponse.headers,
          body:
            contentType === 'application/json'
              ? JSON.stringify(coreResponse.body)
              : (coreResponse.body as undefined | string),
          contentType: contentType,
        })
        resolve(true)
      })

      if (!didMatch) {
        resolve(false)
      }
    })

    if (request.isInterceptResolutionHandled()) return
    await request.continue()
  })

  page.on('close', () => {
    resetService(service)
  })
}

export type DynamockOptions = {
  configuration?: Partial<ConfigurationType> | null
  resetConfiguration?: boolean
  fixtures?: FixturePuppeteerType[]
  deleteFixtures?: string[]
  resetFixtures?: boolean
}

export async function dynamock(
  page: Page,
  {
    configuration = null,
    resetConfiguration = false,
    fixtures = [],
    deleteFixtures = [],
    resetFixtures = false,
  }: DynamockOptions,
) {
  if (resetConfiguration) {
    deleteServiceConfiguration(service)
  }

  if (configuration) {
    const [configurationStatus, configurationOrError] = updateServiceConfiguration(service, configuration)

    if (configurationStatus !== 200 && configurationOrError && 'message' in configurationOrError) {
      throw new Error(String(configurationOrError.message))
    }
  }

  if (resetFixtures) {
    deleteServiceFixtures(service)
  } else if (deleteFixtures.length) {
    for (const deleteFixture of deleteFixtures) {
      deleteServiceFixture(service, deleteFixture)
    }
  }

  if (fixtures.length) {
    let coreFixtures: FixtureType[] = []

    try {
      coreFixtures = fixtures.map(mapToFixtureType)
    } catch (error) {
      const [, { message }] = createServiceError(0, 'Missing or invalid request.url')
      throw new Error(message)
    }

    const [fixturesStatus, fixturesOrError] = createServiceFixtures(service, coreFixtures)

    if (fixturesStatus !== 200 && fixturesOrError && 'message' in fixturesOrError) {
      throw new Error(String(fixturesOrError.message))
    }
  }

  if (!initialized) {
    await initializeInterceptor(page)
    initialized = true
  }
}
