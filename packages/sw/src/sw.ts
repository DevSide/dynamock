import {
  type DeleteConfig,
  type DeleteFixture,
  type DeleteFixtures,
  type GetConfig,
  type PostFixture,
  type PostFixtures,
  type PutConfig,
  messageSchema,
} from './message.js'
import {
  type CoreResponse,
  createService,
  createServiceFixture,
  createServiceFixtures,
  deleteServiceConfiguration,
  deleteServiceFixture,
  deleteServiceFixtures,
  getServiceConfiguration,
  matchServiceRequestAgainstFixtures,
  updateServiceConfiguration,
} from '@dynamock/core'
import { mapToCoreRequest, mapToFixtureType } from './mapper.js'
import type { FixtureSWType } from './fixture.js'

declare const self: ServiceWorkerGlobalScope
const service = createService()

self.addEventListener('message', function messageHandler(evt: Event) {
  const event = evt as MessageEvent
  const source = event.source

  if (!source) {
    return
  }

  const { success, data: rawRequest } = messageSchema.safeParse(event.data)

  if (!success || !('data' in rawRequest)) {
    return
  }

  const type = rawRequest.type
  const requestData = rawRequest.data

  switch (type) {
    case 'GET_CONFIG': {
      const data = getServiceConfiguration(service)
      source.postMessage({ type, data } as GetConfig['response'])
      break
    }
    case 'PUT_CONFIG': {
      const data = updateServiceConfiguration(service, requestData)
      source.postMessage({ type, data } as PutConfig['response'])
      break
    }
    case 'DELETE_CONFIG': {
      const data = deleteServiceConfiguration(service)
      source.postMessage({ type, data } as DeleteConfig['response'])
      break
    }
    case 'POST_FIXTURE': {
      const coreFixture = mapToFixtureType(requestData)
      const data = createServiceFixture(service, coreFixture)
      source.postMessage({ type, data } as PostFixture['response'])
      break
    }
    case 'DELETE_FIXTURE': {
      const data = deleteServiceFixture(service, requestData)
      source.postMessage({ type, data } as DeleteFixture['response'])
      break
    }
    case 'POST_FIXTURES': {
      const coreFixtures = Array.isArray(requestData) ? requestData.map(mapToFixtureType) : requestData
      const data = createServiceFixtures(service, coreFixtures)
      source.postMessage({ type, data } as PostFixtures['response'])
      break
    }
    case 'DELETE_FIXTURES': {
      const data = deleteServiceFixtures(service)
      source.postMessage({ type, data } as DeleteFixtures['response'])
      break
    }
  }
})

self.addEventListener('fetch', async (evt: Event) => {
  const event = evt as FetchEvent
  const request = event.request

  const coreRequest = await mapToCoreRequest(request)

  await new Promise((resolve, reject) => {
    const didMatch = matchServiceRequestAgainstFixtures(service, coreRequest, (coreResponse: CoreResponse) => {
      // TODO: filepath exclude
      // TODO: need to computer cookies with coreResponse.cookies
      // TODO: body should be string|undefined in CoreResponse, already parsed
      const contentType = coreResponse.headers['content-type'] ?? ''
      let body = undefined
      const status = coreResponse.status

      if (coreResponse.filepath) {
        return reject(new Error('filepath cannot be handle by sw'))
      }

      body =
        contentType === 'application/json'
          ? JSON.stringify(coreResponse.body)
          : (coreResponse.body as undefined | string)

      event.respondWith(
        new Response(body, {
          status,
          headers: coreResponse.headers,
        }),
      )

      resolve(true)
    })

    if (!didMatch) {
      resolve(false)
    }
  })
})

self.addEventListener('install', () => {
  self.skipWaiting()
})
