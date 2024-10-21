import { deepStrictEqual } from 'node:assert'
import { isIncluded, matchRegex } from './utils.js'
import type { NormalizedFixtureRequestType } from './fixtures.js'
import type { CoreRequest } from './request.js'

export const REQUEST_PROPERTIES: ['headers', 'body', 'query', 'cookies'] = ['headers', 'body', 'query', 'cookies']

export function requestPropertyMatch(
  request: CoreRequest,
  match: NormalizedFixtureRequestType,
  property: 'origin' | 'path' | 'method' | 'headers' | 'cookies' | 'query' | 'body',
) {
  if (property === 'origin' || property === 'path' || property === 'method') {
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
