import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { URL } from 'node:url'
import { load } from 'js-yaml'
import type { HeadersInit } from 'undici-types/fetch.js'

function readDirectoryRecursively(directory: string): string[][] {
  let results: string[][] = []
  const files = readdirSync(directory)

  for (const file of files) {
    const fullPath = join(directory, file)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      results = results.concat(readDirectoryRecursively(fullPath))
    } else {
      results.push([fullPath])
    }
  }

  return results
}

export function getTestFiles() {
  const { pathname } = new URL('./test-files', import.meta.url)

  return readDirectoryRecursively(pathname).filter(([fullPath]) => fullPath.endsWith('.yml'))
}

export type YMLTestCaseExpectation = {
  status?: number
  headers?: { [key: string]: string }
  body?: null | string
  bodyJSON?: unknown
  minElapsedTime?: number
}

type YMLTestCase<A extends string> = {
  action: {
    name: A
    json: boolean
    data: object
  }
  expectation: YMLTestCaseExpectation
}

export type ApiTest = {
  path: string
  method: string
  headers?: { [key: string]: string }
  cookies?: { [key: string]: string }
  query?: { [key: string]: string }
  body?: null | string
  bodyJSON?: unknown
}

export enum ActionEnum {
  put_config = 'put_config',
  get_config = 'get_config',
  delete_config = 'delete_config',
  post_fixture = 'post_fixture',
  post_fixtures_bulk = 'post_fixtures_bulk',
  delete_fixture = 'delete_fixture',
  delete_all_fixtures = 'delete_all_fixtures',
  test_fixture = 'test_fixture',
}

const actions = Object.values(ActionEnum)

export type AnyYMLTestCase = YMLTestCase<
  | 'put_config'
  | 'get_config'
  | 'delete_config'
  | 'post_fixture'
  | 'post_fixtures_bulk'
  | 'delete_fixture'
  | 'delete_all_fixtures'
  | 'test_fixture'
>

export function getYMLTestCases(absolutePath: string): AnyYMLTestCase[] {
  const content = readFileSync(absolutePath).toString()
  const data = load(content)

  // Validate yml
  if (!Array.isArray(data)) {
    throw new Error('TestCases not array')
  }

  for (const testCase of data) {
    if (typeof testCase === 'undefined') {
      throw new Error('TestCase not object')
    }

    if (typeof testCase.expectation !== 'object') {
      throw new Error('TestCase.expectation not object')
    }

    if (typeof testCase.action !== 'object') {
      throw new Error('TestCase.action not object')
    }

    if (!actions.includes(testCase.action.name)) {
      throw new Error(`TestCase action not in list: ${actions}`)
    }

    if (testCase.action.json === false) {
      testCase.action.json = true
    }
  }

  return data
}

export async function wrapError(testIndex: number, task: () => unknown) {
  try {
    return await task()
  } catch (error: unknown) {
    if (error instanceof Error) {
      error.message += `\nTest iteration ${testIndex}`
    }
    throw error
  }
}
