import { afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import { spawn, type ChildProcess } from 'node:child_process'
import { getTestFiles, wrapError } from '@dynamock/test-cases'
import { waitPortFree, waitPortUsed } from './config/utils.js'
import { getServerTestCases } from './config/getTestCases.js'
import { writeFileSync } from 'node:fs'

describe('bin integration tests', () => {
  const allTests = getTestFiles() //.filter(([filePath]) => filePath.includes('create-and-delete-bulk.yml'))
  const port = 3000
  let process: ChildProcess

  beforeAll(async () => {
    await waitPortFree(port)
  })

  beforeEach(async () => {
    process = spawn('dynamock', [String(port)] /*, {stdio: 'inherit'}*/)
    await waitPortUsed(port)
  })

  afterEach(async () => {
    if (process) {
      process.kill('SIGHUP')
      await waitPortFree(port)
    }
  })

  test.each(allTests)('Test %s', async (absoluteFilePath) => {
    const testData = getServerTestCases(absoluteFilePath)

    for (let i = 0; i < testData.length; i++) {
      const wrap = wrapError(absoluteFilePath, i)
      const { action, expectation } = testData[i]
      const { path, method, headers, cookies, body, bodyJSON, query } = action
      const fetchOptions: {
        method: string
        headers: { [key: string]: string }
        body: null | string
      } = {
        method,
        headers: headers ?? {},
        body: null,
      }

      if (bodyJSON !== undefined) {
        // @ts-ignore
        const filepath = String(bodyJSON?.response?.filepath)

        if (filepath?.startsWith('/')) {
          writeFileSync(filepath, 'world')
        }

        fetchOptions.body = JSON.stringify(bodyJSON)
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        }
      } else if (body !== undefined) {
        fetchOptions.body = String(body)
      }

      const url = new URL(`http://127.0.0.1:${port}${path}`)

      for (const queryKey in query) {
        url.searchParams.set(queryKey, query[queryKey])
      }

      // nodejs fetch method "patch" is working only in upper case
      // CF: https://github.com/nodejs/node/issues/51336
      if (fetchOptions.method === 'patch') {
        fetchOptions.method = 'PATCH'
      }

      if (cookies) {
        fetchOptions.headers.cookie = Object.entries(cookies)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('; ')
      }

      const time = Date.now()
      const result = await fetch(url.toString(), fetchOptions)

      if (expectation) {
        const { status, headers, body, bodyJSON, minElapsedTime } = expectation

        if (minElapsedTime) {
          expect(Date.now() - time).toBeGreaterThan(minElapsedTime)
        }

        if (status) {
          await wrap(() => expect(result.status).toBe(status))
        }

        if (headers) {
          await wrap(() => expect(Object.fromEntries(result.headers)).toMatchObject(headers))
        }

        if (bodyJSON !== undefined) {
          await wrap(async () => expect(await result.json()).toEqual(bodyJSON))
        } else if (body !== undefined) {
          await wrap(async () => expect(await result.text()).toEqual(body))
        }
      }
    }
  })
})
