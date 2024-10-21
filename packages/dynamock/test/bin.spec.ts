import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { getTestFiles } from '@dynamock/test-cases'
import { fetchWithBaseUrl, waitPortFree, waitPortUsed, wrapError } from './config/utils.js'
import { getServerTestCases } from './config/getTestCases.js'

describe('bin integration tests', () => {
  const allTests = getTestFiles()
  const port = 5000
  const fetchDynamock = fetchWithBaseUrl(fetch, `http://localhost:${port}`)
  let process: ChildProcessWithoutNullStreams

  beforeEach(async () => {
    process = spawn('dynamock', [String(port)])
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
      const { path, ...options } = action

      const result = await fetchDynamock(path, options)

      if (expectation) {
        const { status, body, bodyJSON } = expectation

        if (status) {
          await wrapError(i, () => expect(result.status).toBe(status))
        }

        if (bodyJSON) {
          await wrapError(i, async () => expect(await result.json()).toEqual(bodyJSON))
        } else if (body !== undefined) {
          await wrapError(i, async () => expect(await result.json()).toEqual(body))
        }
      }
    }
  })
})
