import crypto from 'node:crypto'
import { deepStrictEqual } from 'node:assert'

export { isObjectEmpty }

function isObjectEmpty(object: object | null) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) return false
  }
  return true
}

function isObject(maybeObject: unknown): maybeObject is object {
  return typeof maybeObject === 'object' && !Array.isArray(maybeObject)
}

const stringRegexp = /\/(.*)\/([gimuys]*)/

function matchRegex(value: string, baseValue: string) {
  const matchRegExp = value.match(stringRegexp)

  if (matchRegExp) {
    const [, regexp, flags] = matchRegExp

    if (new RegExp(regexp, flags).test(baseValue)) {
      return true
    }
  }

  return false
}

export { matchRegex }

export function isIncluded(
  object: { [key in string]?: unknown } | undefined,
  base: { [key in string]?: unknown },
  allowRegex: boolean,
) {
  for (const key in object) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      continue
    }

    const value = object[key]
    const baseValue = base[key]

    if (isObject(value) && value !== null) {
      if (isObject(baseValue) && isIncluded(value, baseValue, allowRegex)) {
        continue
      }
    }

    if (allowRegex && typeof value === 'string' && typeof baseValue === 'string' && matchRegex(value, baseValue)) {
      continue
    }

    try {
      deepStrictEqual(value, baseValue)
      continue
    } catch (_) {}

    return false
  }

  return true
}

// @ts-ignore
export function sortObjectKeysRecurs(src: null | { [key: string]: unknown } | { [key: string]: unknown }[]) {
  if (Array.isArray(src)) {
    const out = []

    for (const item of src) {
      out.push(sortObjectKeysRecurs(item))
    }

    return out
  }

  if (typeof src === 'object' && src !== null) {
    const out = {} as { [key: string]: unknown }
    const sortedKeys = Object.keys(src).sort()

    for (const key of sortedKeys) {
      out[key] = sortObjectKeysRecurs(src[key] as null | { [key: string]: unknown } | { [key: string]: unknown }[])
    }

    return out
  }

  return src
}

export function hash(str: string) {
  return crypto.createHash('sha1').update(str).digest('hex')
}

export type NonEmptyArray<T> = [T, ...T[]] | [...T[], T] | [T, ...T[], T]
