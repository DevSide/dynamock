import { jest, afterEach, describe, expect, test, beforeEach } from '@jest/globals'
import { ActionEnum, getTestFiles, wrapError } from '@dynamock/test-cases'
import { page } from './config/setupTests.js'
import { getSWTestCases } from './config/getSWTestCases.js'
import type { DynamockSW } from '../src/client.js'

describe('sw integration tests', () => {
  const allTests = getTestFiles()
  // .filter(([filePath]) => filePath.includes('create-and-delete-all'))

  afterEach(async () => {
    await page.evaluate(() => {
      // @ts-ignore
      return window.dynamock.unregister()
    })
    jest.resetModules()
  })

  beforeEach(async () => {
    await page.goto('http://127.0.0.1:3000/index.html')

    return page.evaluate(async () => {
      // @ts-ignore
      const { dynamock } = await import('./___client.js')
      // @ts-ignore
      window.dynamock = (await dynamock('/___sw.js')) as DynamockSW
    })
  })

  test.each(allTests)('Test %s', async (absoluteFilePath) => {
    const testData = getSWTestCases(absoluteFilePath, 'http://127.0.0.1:3000')

    for (let i = 0; i < testData.length; i++) {
      const { action, expectation } = testData[i]
      const wrap = wrapError(absoluteFilePath, i)

      // @ts-ignore
      for (const { response } of action.data?.fixtures ?? []) {
        if (response?.filepath) {
          throw new Error('filepath cannot be handle by sw')
        }
      }

      if (action.name !== ActionEnum.test_fixture) {
        const result = await page.evaluate(
          (_action, _actionEnum) => {
            if (!('dynamock' in window)) {
              return null
            }

            const dynamock = window.dynamock as DynamockSW

            switch (_action.name) {
              case _actionEnum.get_config:
                return dynamock.getConfiguration()
              case _actionEnum.put_config:
                return dynamock.updateConfiguration(_action.data.configuration ?? {})
              case _actionEnum.delete_config:
                return dynamock.deleteConfiguration()
              case _actionEnum.post_fixture:
                return dynamock.addFixture(_action.data.fixture)
              case _actionEnum.delete_fixture:
                return dynamock.removeFixture(_action.data.fixtureId)
              case _actionEnum.post_fixtures_bulk:
                return dynamock.addFixtures(_action.data.fixtures)
              case _actionEnum.delete_all_fixtures:
                return dynamock.removeFixtures()
              default:
                return null
            }
          },
          action,
          ActionEnum,
        )

        if (!result) {
          throw new Error('No result')
        }

        if (expectation.status === 409) {
          await wrap(() => {
            expect(result[0]).toBe(409)
            // @ts-ignore
            expect(result[1]?.message.substring(0, 21)).toBe('[FIXTURE SERVER ERROR')
          })
        } else {
          if (expectation.status) {
            await wrap(() => {
              expect(result[0]).toBe(expectation.status)
            })
          }
          if (expectation.bodyJSON) {
            await wrap(() => {
              expect(result[1]).toEqual(expectation.bodyJSON)
            })
          }
        }
        return
      }

      const result = await page.evaluate(
        async ({ path, method, headers, cookies, query, body, bodyJSON }, expectBodyJSON, expectBody) => {
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

          const url = new URL(`http://127.0.0.1:3000${path}`)

          for (const queryKey in query) {
            url.searchParams.set(queryKey, query[queryKey])
          }

          if (cookies) {
            fetchOptions.headers.cookie = Object.entries(cookies)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
              .join('; ')
          }

          const time = Date.now()

          const result = await fetch(url.toString(), fetchOptions)

          return {
            url: url.toString(),
            timeElapsed: Date.now() - time,
            status: result.status,
            headers: Object.fromEntries(result.headers),
            body: expectBodyJSON ? await result.json() : expectBody ? await result.text() : undefined,
          }
        },
        action.data,
        expectation?.bodyJSON !== undefined,
        expectation?.body !== undefined,
      )

      if (expectation) {
        const { status, headers, body, bodyJSON, minElapsedTime } = expectation

        if (minElapsedTime) {
          await wrap(() => expect(result.timeElapsed).toBeGreaterThan(minElapsedTime))
        }

        if (status) {
          await wrap(() => expect(result.status).toBe(status))
        }

        if (headers) {
          await wrap(() => expect(result.headers).toMatchObject(headers))
        }

        if (bodyJSON !== undefined) {
          await wrap(async () => expect(await result.body).toEqual(bodyJSON))
        } else if (body !== undefined) {
          await wrap(async () => expect(await result.body).toEqual(body))
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
