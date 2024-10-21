import { beforeEach, describe, expect, test } from '@jest/globals'
import { page } from './config/setupTests.js'
import { getTestFiles } from '@dynamock/test-cases'
import { getPuppeteerTestCases } from './config/getTestCases.js'

describe('puppeteer integration tests', () => {
  const allTests = getTestFiles()

  beforeEach(() => page.goto('http://127.0.0.1:3000/'))

  test.each(allTests)('Test %s', async (absoluteFilePath) => {
    const { dynamock } = await import('../src/index.js')
    const testData = getPuppeteerTestCases(absoluteFilePath)

    for (let i = 0; i < testData.length; i++) {
      const { action, expectation } = testData[i]

      if (
        action.configuration !== undefined ||
        action.resetConfiguration !== undefined ||
        action.fixtures !== undefined
      ) {
        if (expectation.status === 400) {
          try {
            await dynamock(page, action)
          } catch (error: unknown) {
            if (error instanceof Error) {
              expect(error.message.substring(0, 21)).toBe('[FIXTURE SERVER ERROR')
            } else {
              expect('error is not an instanceof Error').toBe(false)
            }
          }
        } else {
          await expect(dynamock(page, action)).resolves.toBe(undefined)
        }
      }

      // const result = await page.evaluate(async () => {
      //   const result = await fetch('http://127.0.0.1:5000/pandas/1', {
      //     method: 'POST',
      //   })
      //
      //   return {
      //     status: result.status,
      //     body: await result.json(),
      //   }
      // })
      //
      // expect(result).toEqual({
      //   status: 201,
      //   body: {
      //     id: 1,
      //   },
      // })
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
