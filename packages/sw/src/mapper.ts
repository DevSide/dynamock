import type { FixtureType } from '@dynamock/core'
import type { FixtureSWType } from './fixture.js'
import { z } from 'zod'

export async function mapToCoreRequest(request: Request) {
  const headers = request.headers
  const postData = request.body
  let body = undefined

  if (postData !== null) {
    const contentType = headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => undefined)
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = await request.text().catch(() => undefined)
      const searchParams = new URLSearchParams(body)
      body = Object.fromEntries(searchParams.entries())
    }
  }

  const parsedUrl = new URL(request.url)

  const cookieHeader = headers.get('cookie')
  headers.delete('cookie')

  const cookies = cookieHeader
    ? Object.fromEntries(
        cookieHeader.split('; ').map((cookie: string) => {
          const [key, value] = cookie.split('=')
          return [decodeURIComponent(key), decodeURIComponent(value)]
        }),
      )
    : {}

  return {
    origin: parsedUrl.origin,
    path: parsedUrl.pathname,
    method: request.method,
    body,
    headers: Object.fromEntries(headers.entries()),
    cookies,
    query: Object.fromEntries(parsedUrl.searchParams.entries()),
  }
}

const rawFixtureSchema = z
  .object({
    request: z
      .object({
        url: z.string(),
      })
      .passthrough(),
  })
  .passthrough()

export function mapToFixtureType(rawFixture: unknown): unknown {
  const { success, data: fixture } = rawFixtureSchema.safeParse(rawFixture)

  if (!success) {
    return rawFixture
  }

  const url = fixture.request.url
  let origin = ''
  let path = ''

  try {
    const parsedUrl = new URL(url)
    origin = parsedUrl.origin
    path = decodeURI(parsedUrl.toString()).replace(parsedUrl.origin, '')
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
