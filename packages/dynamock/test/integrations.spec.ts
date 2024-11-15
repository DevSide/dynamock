import { beforeAll, afterEach, afterAll, describe, test, beforeEach } from '@jest/globals'
import supertest from 'supertest'
import { createServer } from '../src/createServer.js'

describe('integrations.js', () => {
  let server = createServer()
  let request = supertest.agent(server)

  beforeAll((done) => {
    server = createServer()
    server.listen(done)
    request = supertest.agent(server)
  })

  afterEach(() => Promise.all([request.delete('/___config'), request.delete('/___fixtures')]))

  afterAll((done) => {
    server.close(done)
  })

  describe('create and delete fixtures', () => {
    // Special case:
    // We need the same supertest/server port in order to reproduce the sha1 of a fixture
    // Because it modifies the origin of the request
    beforeEach(async () => {
      await new Promise((resolve) => server.close(() => resolve(true)))
      request = supertest.agent(server)
      await new Promise((resolve) => server.listen(1111, () => resolve(true)))
    })

    test('cannot create >10mb fixture', () => {
      return request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'post',
          },
          response: {
            status: 201,
            body: '0'.repeat(10500000),
          },
        })
        .expect(413)
    })
  })

  describe('matching path', () => {
    test.only.each([
      ['/ a', null, '/ a', true],
      ['/ a', null, '/%20a', true],
      ['/%20a', null, '/ a', false],
      ['/%20a', null, '/%20a', false],
      ['/%20a', { disableEncodeURI: true }, '/ a', true],
      ['/%20a', { disableEncodeURI: true }, '/%20a', true],
      ['//%20a/', { allowRegex: true }, '/ a', true],
    ])('matching path match="%s" options="%o" test="%s" result=%s', async (matchPath, options, path, shouldMatch) => {
      const method = 'get'

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: matchPath,
            method,
            ...(options
              ? {
                  options: {
                    path: options,
                  },
                }
              : {}),
          },
          response: {
            body: '',
          },
        })
        .expect(201)

      await request[method](path).expect(shouldMatch ? 200 : 404)
    })
  })
})
