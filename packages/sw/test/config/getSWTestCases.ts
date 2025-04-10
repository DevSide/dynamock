import {
  ActionEnum,
  type AnyYMLTestCase,
  type ApiTest,
  getYMLTestCases,
  type YMLTestCaseExpectation,
} from '@dynamock/test-cases'
import type { FixtureSWType } from '../../src/fixture.js'
import type { ConfigurationType } from '@dynamock/core'

type SWTestCase<T extends ActionEnum, D> = {
  action: {
    name: T
    data: D
  }
  expectation: YMLTestCaseExpectation
}

type AllSWTestCase =
  | SWTestCase<ActionEnum.get_config, null>
  | SWTestCase<ActionEnum.put_config, { configuration: Partial<ConfigurationType> | null }>
  | SWTestCase<ActionEnum.delete_config, null>
  | SWTestCase<ActionEnum.post_fixture, { fixture: FixtureSWType }>
  | SWTestCase<ActionEnum.post_fixtures_bulk, { fixtures: FixtureSWType[] }>
  | SWTestCase<ActionEnum.delete_fixture, { fixtureId: string }>
  | SWTestCase<ActionEnum.delete_all_fixtures, null>
  | SWTestCase<ActionEnum.test_fixture, ApiTest>

export function getSWTestCases(absolutePath: string, origin: string): AllSWTestCase[] {
  const ymlTestCases: AnyYMLTestCase[] = getYMLTestCases(absolutePath)

  const testCases: (AllSWTestCase | null)[] = ymlTestCases.map(({ action, expectation }) => {
    const { name, data } = action
    let newData = undefined

    switch (name) {
      case ActionEnum.get_config:
        return {
          action: {
            name: ActionEnum.get_config,
            data: null,
          },
          expectation,
        }
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
            data: null,
          },
          expectation,
        }
      case ActionEnum.post_fixture: {
        newData = data as FixtureSWType

        // @ts-ignore
        const path = data?.request?.path ?? ''

        if (path) {
          newData.request.url = origin + path
        }

        return {
          action: {
            name: ActionEnum.post_fixture,
            data: {
              fixture: newData as FixtureSWType,
            },
          },
          expectation,
        }
      }
      case ActionEnum.post_fixtures_bulk: {
        newData = data as FixtureSWType[]

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
              fixtureId: newData,
            },
          },
          expectation,
        }
      }
      case ActionEnum.delete_all_fixtures:
        return {
          action: {
            name: ActionEnum.delete_all_fixtures,
            data: null,
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
