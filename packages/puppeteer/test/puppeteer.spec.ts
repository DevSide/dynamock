import { jest, afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { page } from './config/setupTests.js'
import { ActionEnum, getTestFiles, wrapError } from '@dynamock/test-cases'
import { getPuppeteerTestCases } from './config/getTestCases.js'

describe('puppeteer integration tests', () => {
  const allTests = getTestFiles().filter(([filePath]) => filePath.endsWith('.yml'))

  beforeEach(() => page.goto('http://127.0.0.1:3000/index.html'))

  afterEach(() => {
    jest.resetModules()
  })

  test.each(allTests)('Test %s', async (absoluteFilePath) => {
    const { dynamock } = await import('../src/index.js')
    const testData = getPuppeteerTestCases(absoluteFilePath, 'http://127.0.0.1:3000')

    for (let i = 0; i < testData.length; i++) {
      const { action, expectation } = testData[i]
      // @ts-ignore
      // console.log(action.name, action.data, expectation)
      switch (action.name) {
        case ActionEnum.put_config:
        case ActionEnum.delete_config:
        case ActionEnum.post_fixture:
        case ActionEnum.post_fixtures_bulk:
        case ActionEnum.delete_fixture:
        case ActionEnum.delete_all_fixtures: {
          if (expectation.status === 400 || expectation.status === 409) {
            try {
              await dynamock(page, action.data)
            } catch (error: unknown) {
              if (error instanceof Error) {
                await wrapError(i, () => expect(error.message.substring(0, 21)).toBe('[FIXTURE SERVER ERROR'))
              } else {
                await wrapError(i, () => expect('error is not an instanceof Error').toBe(false))
              }
            }
          } else {
            await expect(dynamock(page, action.data)).resolves.toBe(undefined)
          }
          break
        }
        case ActionEnum.test_fixture: {
          const { path, method, body, bodyJSON, headers, query } = action.data
          const safeHeaders = headers ?? {}
          const safeQuery = query ?? {}

          const result = await page.evaluate(
            async (_path, _method, _body, _bodyJSON, _headers, _query) => {
              const fetchOptions: {
                method: string
                headers: { [key: string]: string }
                body: null | string
              } = {
                method: _method,
                headers: _headers,
                body: null,
              }

              if (_bodyJSON !== undefined) {
                fetchOptions.body = JSON.stringify(_bodyJSON)
                fetchOptions.headers = {
                  ...fetchOptions.headers,
                  'Content-Type': 'application/json',
                }
              } else if (_body !== undefined) {
                fetchOptions.body = String(_body)
              }

              const url = new URL(`http://127.0.0.1:3000${_path}`)

              for (const queryKey in _query) {
                url.searchParams.set(queryKey, _query[queryKey])
              }

              const result = await fetch(url.toString(), fetchOptions)

              const bodyText = await result.text()

              let bodyJSON = undefined
              try {
                bodyJSON = JSON.parse(bodyText)
              } catch (error) {}

              return {
                status: result.status,
                headers: Object.entries(_headers).reduce<{ [key: string]: string }>((acc, [key, value]) => {
                  acc[key] = value

                  return acc
                }, {}),
                bodyText,
                bodyJSON,
              }
            },
            path,
            method,
            body,
            bodyJSON,
            safeHeaders,
            safeQuery,
          )

          if (expectation.status) {
            await wrapError(i, () => expect(result.status).toBe(expectation.status))
          }

          if (expectation.headers) {
            // @ts-ignore
            await wrapError(i, () => expect(result.headers).toMatchObject(expectation.headers))
          }

          if (expectation.bodyJSON !== undefined) {
            await wrapError(i, async () => expect(result.bodyJSON).toEqual(expectation.bodyJSON))
          } else if (expectation.body !== undefined) {
            await wrapError(i, async () => expect(result.bodyText).toEqual(expectation.body))
          }
        }
      }
    }
  })

  // test('should', async () => {
  //   await dynamock(page, { cors: '*' }, [
  //     {
  //       request: {
  //         url: 'http://127.0.0.1:5000/pandas/1',
  //         method: 'POST',
  //       },
  //       response: {
  //         status: 201,
  //         headers: {
  //           'content-type': 'application/json',
  //         },
  //         body: {
  //           id: 1,
  //         },
  //       },
  //     },
  //   ])
  //
  //   const result = await page.evaluate(async () => {
  //     const result = await fetch('http://127.0.0.1:5000/pandas/1', {
  //       method: 'POST',
  //     })
  //
  //     return {
  //       status: result.status,
  //       body: await result.json(),
  //     }
  //   })
  //
  //   expect(result).toEqual({
  //     status: 201,
  //     body: {
  //       id: 1,
  //     },
  //   })
  // })
})
