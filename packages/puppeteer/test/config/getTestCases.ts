import {
  ActionEnum,
  type AnyYMLTestCase,
  type ApiTest,
  getYMLTestCases,
  type YMLTestCaseExpectation,
} from '@dynamock/test-cases'
import type { FixturePuppeteerType } from '../../src/index.js'
import type { ConfigurationType } from '@dynamock/core'

type PuppeteerTestCase<T extends ActionEnum, D> = {
  action: {
    name: T
    data: D
  }
  expectation: YMLTestCaseExpectation
}

type AllPuppeteerTestCase =
  | PuppeteerTestCase<ActionEnum.put_config, { configuration: Partial<ConfigurationType> | null }>
  | PuppeteerTestCase<ActionEnum.delete_config, { resetConfiguration: true }>
  | PuppeteerTestCase<ActionEnum.post_fixture, { fixtures: FixturePuppeteerType[] }>
  | PuppeteerTestCase<ActionEnum.post_fixtures_bulk, { fixtures: FixturePuppeteerType[] }>
  | PuppeteerTestCase<ActionEnum.delete_fixture, { deleteFixtures: string[] }>
  | PuppeteerTestCase<ActionEnum.delete_all_fixtures, { resetFixtures: true }>
  | PuppeteerTestCase<ActionEnum.test_fixture, ApiTest>

export function getPuppeteerTestCases(absolutePath: string, origin: string): AllPuppeteerTestCase[] {
  const ymlTestCases: AnyYMLTestCase[] = getYMLTestCases(absolutePath)

  const testCases: (AllPuppeteerTestCase | null)[] = ymlTestCases.map(({ action, expectation }) => {
    const { name, data } = action

    switch (name) {
      case ActionEnum.get_config:
        return null
      case ActionEnum.put_config:
        return {
          action: {
            name: ActionEnum.put_config,
            data: {
              configuration: data as Partial<ConfigurationType> | null,
            },
          },
          expectation,
        }
      case ActionEnum.delete_config:
        return {
          action: {
            name: ActionEnum.delete_config,
            data: {
              resetConfiguration: true,
            },
          },
          expectation,
        }
      case ActionEnum.post_fixture: {
        const newData: FixturePuppeteerType = data as FixturePuppeteerType

        // @ts-ignore
        const path = data?.request?.path ?? ''

        if (path) {
          newData.request.url = origin + path
        }

        return {
          action: {
            name: ActionEnum.post_fixture,
            data: {
              fixtures: [newData] as FixturePuppeteerType[],
            },
          },
          expectation,
        }
      }
      case ActionEnum.post_fixtures_bulk: {
        const newData = data as FixturePuppeteerType[]

        if (Array.isArray(newData)) {
          for (const fixture of newData) {
            // @ts-ignore
            const path = fixture?.request?.path ?? ''

            if (path) {
              fixture.request.url = origin + path
            }
          }
        }

        return {
          action: {
            name: ActionEnum.post_fixtures_bulk,
            data: {
              fixtures: newData,
            },
          },
          expectation,
        }
      }
      case ActionEnum.delete_fixture: {
        // @ts-ignore
        const newData = data?.id as string

        return {
          action: {
            name: ActionEnum.delete_fixture,
            data: {
              deleteFixtures: [newData],
            },
          },
          expectation,
        }
      }
      case ActionEnum.delete_all_fixtures:
        return {
          action: {
            name: ActionEnum.delete_all_fixtures,
            data: {
              resetFixtures: true,
            },
          },
          expectation,
        }
      case ActionEnum.test_fixture:
        return {
          action: {
            name: ActionEnum.test_fixture,
            data: data as ApiTest,
          },
          expectation,
        }
      default:
        return null
    }
  })

  return testCases.filter((testCase) => testCase !== null)
}
