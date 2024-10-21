import type { CoreRequest, FixtureRequestType, FixtureResponseType, FixtureType } from '@dynamock/core'
import type { Request } from 'express'

export function mapToCoreRequest(req: Request) {
  const coreRequest: CoreRequest = {
    origin: `${req.protocol}://${req.get('host')}`,
    path: req.path,
    method: req.method,
    headers: Object.entries(req.headers).reduce<{ [key in string]: string }>((acc, [headerKey, headerValue]) => {
      if (headerValue) {
        if (typeof headerValue === 'string') {
          acc[headerKey] = headerValue
        }
      }

      return acc
    }, {}),
    cookies: req.cookies,
    query: Object.entries(req.query).reduce<{ [key in string]: string }>((acc, [headerKey, headerValue]) => {
      if (headerValue) {
        if (typeof headerValue === 'string') {
          acc[headerKey] = headerValue
        }
      }

      return acc
    }, {}),
    body: req.body,
  }

  return coreRequest
}

type FixtureServerType = {
  request: Omit<FixtureRequestType, 'origin'>
  response: FixtureResponseType
}

function mapToFixtureType(req: Request, fixture: FixtureServerType): FixtureType {
  return {
    ...fixture,
    request: {
      ...fixture.request,
      origin: `${req.protocol}://${req.get('host')}`,
    },
  }
}
