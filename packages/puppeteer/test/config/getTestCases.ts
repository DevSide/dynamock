import { type AnyYMLTestCase, getYMLTestCases } from '@dynamock/test-cases'
import type { DynamockOptions, FixturePuppeteerType } from '../../src/index.js'
import type { ConfigurationType } from '@dynamock/core/dist/configuration.js'

type PuppeteerTestCase = {
  action: DynamockOptions
  expectation: {
    status?: number
    body?: unknown
    bodyJSON?: unknown
  }
}

export function getPuppeteerTestCases(absolutePath: string): PuppeteerTestCase[] {
  const ymlTestCases: AnyYMLTestCase[] = getYMLTestCases(absolutePath)

  const testCases: (PuppeteerTestCase | null)[] = ymlTestCases.map(({ action, expectation }) => {
    const { name, data } = action

    switch (name) {
      case 'get_config':
        return null
      case 'put_config':
        return {
          action: {
            configuration: data as Partial<ConfigurationType> | null,
          },
          expectation,
        }
      case 'delete_config':
        return {
          action: {
            resetConfiguration: true,
          },
          expectation,
        }
      case 'post_fixture':
        return {
          action: {
            fixtures: data as FixturePuppeteerType[],
          },
          expectation,
        }
      default:
        return null
    }
  })

  return testCases.filter((testCase) => testCase !== null)
}
