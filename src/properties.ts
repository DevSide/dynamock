import { deepStrictEqual } from 'node:assert'
import { isIncluded, matchRegex } from './utils.js'
import type { NormalizedFixtureRequestType } from './fixtures.js'
import type { Request, Response } from 'express'

export const REQUEST_PROPERTIES: ['headers', 'body', 'query', 'cookies'] = ['headers', 'body', 'query', 'cookies']
export const RESPONSE_PROPERTIES: ['headers', 'cookies', 'filepath', 'body'] = [
  'headers',
  'cookies',
  'filepath',
  'body',
]

export function requestPropertyMatch(
  request: Request,
  match: NormalizedFixtureRequestType,
  property: 'path' | 'method' | 'headers' | 'cookies' | 'query' | 'body',
) {
  if (property === 'path' || property === 'method') {
    const matchProperty = match[property]

    if (matchProperty === '*') {
      return true
    }

    const requestProperty = request[property]

    if (match.options?.[property]?.allowRegex) {
      return matchRegex(matchProperty, requestProperty)
    }

    return matchProperty === requestProperty
  }

  let matchProperty = match[property]
  let requestProperty = request[property]
  const optionsProperty = match.options?.[property] || {}

  if (optionsProperty.strict) {
    if (property !== 'body') {
      matchProperty = matchProperty || {}
      requestProperty = requestProperty || {}
    }

    try {
      deepStrictEqual(matchProperty, requestProperty)
      return true
    } catch (_) {
      return false
    }
  }

  if (!matchProperty && property !== 'body') {
    return true
  }

  // @ts-ignore
  return isIncluded(matchProperty, requestProperty, !!optionsProperty.allowRegex)
}

export const useResponseProperties = {
  filepath: (req: Request, res: Response, value: string) => res.sendFile(value),
  headers: (req: Request, res: Response, value: { [key in string]: string } | null) => res.set(value),
  body: (req: Request, res: Response, value: string | null | { [key in string]: string }) => res.send(value),
  cookies: (req: Request, res: Response, cookies: { [key in string]: string } | null) => {
    for (const key in cookies) {
      res.cookie(key, cookies[key])
    }
  },
}
