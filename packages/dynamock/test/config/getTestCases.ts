import { type AnyYMLTestCase, getYMLTestCases } from '@dynamock/test-cases'

type ServerTestCase = {
  action: {
    path: string
    method: string
    headers?: [] | object | null
    cookies?: [] | object | null
    query?: [] | object | null
    options?: object | null
  }
  expectation: {
    status?: number
    body?: unknown
    bodyJSON?: unknown
  }
}

export function getServerTestCases(absolutePath: string): ServerTestCase[] {
  const ymlTestCases: AnyYMLTestCase[] = getYMLTestCases(absolutePath)

  return ymlTestCases.map(({ action, expectation }) => {
    const { name, data } = action

    switch (name) {
      case 'get_config':
        return {
          action: {
            ...data,
            path: '/___config',
            method: 'GET',
          },
          expectation: {
            ...expectation,
            body: undefined,
            bodyJSON: expectation.body,
          },
        }
      case 'put_config':
        return {
          action: {
            ...data,
            path: '/___config',
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          },
          expectation: {
            ...expectation,
            body: undefined,
            bodyJSON: expectation.body,
          },
        }
      case 'delete_config':
        return {
          action: {
            path: '/___config',
            method: 'DELETE',
          },
          expectation,
        }
      case 'post_fixture':
        return {
          action: {
            ...data,
            path: '/___fixtures',
            method: 'POST',
          },
          expectation: {
            ...expectation,
            body: undefined,
            bodyJSON: expectation.body,
          },
        }
    }
  })
}
