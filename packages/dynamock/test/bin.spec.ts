import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { spawn, type ChildProcess } from 'node:child_process'
import { getTestFiles, wrapError } from '@dynamock/test-cases'
import { waitPortFree, waitPortUsed } from './config/utils.js'
import { getServerTestCases } from './config/getTestCases.js'

describe('bin integration tests', () => {
  const allTests = getTestFiles() //.filter(([filePath]) => filePath.endsWith('create-and-delete-bulk.yml'))
  const port = 3000
  let process: ChildProcess

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
      const { action, expectation } = testData[i]
      const { path, method, headers, body, bodyJSON, query } = action
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

      const result = await fetch(url.toString(), fetchOptions)

      if (expectation) {
        const { status, headers, body, bodyJSON } = expectation

        if (status) {
          await wrapError(i, () => expect(result.status).toBe(status))
        }

        if (headers) {
          await wrapError(i, () => expect(result.headers).toMatchObject(headers))
        }

        if (bodyJSON !== undefined) {
          await wrapError(i, async () => expect(await result.json()).toEqual(bodyJSON))
        } else if (body !== undefined) {
          await wrapError(i, async () => expect(await result.text()).toEqual(body))
        }
      }
    }
  })
})