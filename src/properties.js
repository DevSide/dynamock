import { deepStrictEqual } from 'node:assert'
import { isIncluded, matchRegex } from './utils.js'

export const REQUEST_PROPERTIES = ['headers', 'body', 'query', 'cookies']
export const RESPONSE_PROPERTIES = ['headers', 'cookies', 'filepath', 'body']

export function requestPropertyMatch(request, match, property) {
  let requestProperty = request[property]
  let matchProperty = match[property]
  const optionsProperty = match.options?.[property] || {}

  if (property === 'path' || property === 'method') {
    if (matchProperty === '*') {
      return true
    }

    if (optionsProperty.allowRegex) {
      return matchRegex(matchProperty, requestProperty)
    }

    return matchProperty === requestProperty
  }

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

  return isIncluded(matchProperty, requestProperty, !!optionsProperty.allowRegex)
}

export const useResponseProperties = {
  filepath: (req, res, value) => res.sendFile(value),
  headers: (req, res, value) => res.set(value),
  body: (req, res, value) => res.send(value),
  cookies: (req, res, cookies) => {
    for (const key in cookies) {
      res.cookie(key, cookies[key])
    }
  },
}
