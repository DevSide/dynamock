import {
  ActionEnum,
  type AnyYMLTestCase,
  type ApiTest,
  getYMLTestCases,
  type YMLTestCaseExpectation,
} from '@dynamock/test-cases'

type ServerTestCase = {
  action: ApiTest
  expectation: YMLTestCaseExpectation
}

export function getServerTestCases(absolutePath: string): ServerTestCase[] {
  const ymlTestCases: AnyYMLTestCase[] = getYMLTestCases(absolutePath)

  const testCases: (ServerTestCase | null)[] = ymlTestCases.map(({ action, expectation }) => {
    const { name, data } = action

    switch (name) {
      case ActionEnum.get_config:
        return {
          action: {
            path: '/___config',
            method: 'GET',
            bodyJSON: data,
          },
          expectation,
        }
      case ActionEnum.put_config:
        return {
          action: {
            path: '/___config',
            method: 'PUT',
            bodyJSON: data,
          },
          expectation,
        }
      case ActionEnum.delete_config:
        return {
          action: {
            path: '/___config',
            method: 'DELETE',
          },
          expectation,
        }
      case ActionEnum.post_fixture:
        return {
          action: {
            path: '/___fixtures',
            method: 'POST',
            bodyJSON: data,
          },
          expectation,
        }
      case ActionEnum.post_fixtures_bulk:
        return {
          action: {
            path: '/___fixtures/bulk',
            method: 'POST',
            bodyJSON: data,
          },
          expectation,
        }
      case ActionEnum.delete_fixture:
        return {
          action: {
            path: '/___fixtures',
            method: 'DELETE',
            bodyJSON: data,
          },
          expectation,
        }
      case ActionEnum.delete_all_fixtures:
        return {
          action: {
            path: '/___fixtures',
            method: 'DELETE',
          },
          expectation,
        }
      case ActionEnum.test_fixture:
        return {
          action: data as ApiTest,
          expectation,
        }
      default:
        return null
    }
  })

  return testCases.filter((testCase) => testCase !== null)
}
