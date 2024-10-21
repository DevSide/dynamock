import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { URL } from 'node:url'
import { load } from 'js-yaml'

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

type YMLTestCase<A extends string> = {
  action: {
    name: A
    json: boolean
    data: object | null
  }
  expectation: {
    status?: number
    body?: unknown
  }
}

export enum ActionEnum {
  put_config = 'put_config',
  get_config = 'get_config',
  delete_config = 'delete_config',
  post_fixture = 'post_fixture',
}

const actions = Object.values(ActionEnum)

export type AnyYMLTestCase = YMLTestCase<'put_config' | 'get_config' | 'delete_config' | 'post_fixture'>

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
