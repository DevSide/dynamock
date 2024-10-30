import { beforeAll, afterEach, afterAll, describe, test, beforeEach } from '@jest/globals'
import { dirname } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import supertest from 'supertest'
import { createServer } from '../src/createServer.js'

type Method = 'options' | 'put' | 'get' | 'post' | 'head' | 'delete' | 'patch'

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

  describe('manipulate configuration', () => {
    test.each([
      // invalid
      [[], false],
    ])('validate config="%o" response="%o" options="%o" isValid=%s', (config, isValid) => {
      return request
        .put('/___config')
        .send(config)
        .expect(isValid ? 200 : 400)
    })
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

    test('create and remove filepath fixture', async () => {
      await new Promise((resolve) => server.close(() => resolve(true)))
      request = supertest.agent(server)
      await new Promise((resolve) => server.listen(4444, () => resolve(true)))

      const file = '/tmp/panda.txt'

      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, 'pandas !')

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/panda.txt',
            method: 'get',
          },
          response: {
            filepath: file,
          },
        })
        .expect(201, {
          id: 'f7ef2df300684b996e537a6fbe866bbcf8cef317',
        })

      await request
        .get('/panda.txt')
        .expect('Content-Type', /text\/plain/)
        .expect(200, 'pandas !')

      await request.delete('/___fixtures/f7ef2df300684b996e537a6fbe866bbcf8cef317').expect(204)

      await request.get('/panda.txt').expect(404)
    })
  })

  describe('CORS', () => {
    test('allow all', async () => {
      await request.put('/___config').send({ cors: '*' }).expect(200)

      const pathMethods = [
        ['/', 'options'],
        ['/', 'get'],
        ['/toto', 'post'],
      ]

      for (const [path, method] of pathMethods) {
        await request
          .post('/___fixtures')
          .send({
            request: {
              path,
              method,
            },
            response: {
              body: '',
            },
          })
          .expect(201)

        await request[method as Method](path)
          .set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Headers': '*',
          })
          .expect(200)
      }
    })
  })

  describe('matching path', () => {
    test.each([
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

  describe('matching query', () => {
    test.each([
      [null, '/test', { x: '1' }, '/test', null, false],
      [null, '/test', { x: '1' }, '/test', { strict: false }, false],
      [null, '/test', { x: '1' }, '/test', { allowRegex: true }, false],
      [null, '/test', { x: '1' }, '/test', { strict: true }, false],
      [null, '/test', { x: '1' }, '/test?x=1', null, true],
      [null, '/test', { x: ' 1' }, '/test?x=%201', null, true],
      [null, '/test', { x: ' 1' }, '/test?x= 1', null, true],
      [null, '/test', { x: '%201' }, '/test?x=%201', null, false],
      [null, '/test', { x: 1 }, '/test?x=1', null, true],
      [null, '/test', { x: [] }, '/test?x=[]', null, true],
      [null, '/test', { x: { y: 'y' } }, '/test?x={"y":"y"}', null, true],
      [null, '/test', { x: '1' }, '/test?x=1', { strict: true }, true],
      [null, '/test', { x: '1' }, '/test?x=1', { allowRegex: true }, true],
      [null, '/test', { x: '/\\d+/' }, '/test?x=1', { allowRegex: true }, true],
      [null, '/test', { x: '/\\d+/' }, '/test?x=1', null, false],
      [null, '/test', { x: '1' }, '/test?x=2', null, false],
      [null, '/test', { x: '1' }, '/test?x=2', { allowRegex: true }, false],
      [null, '/test', { x: '1' }, '/test?x=2', { strict: true }, false],
      [null, '/test?x=1', {}, '/test?x=1', null, true],
      [null, '/test?x=1', {}, '/test?x=1', { allowRegex: true }, true],
      [null, '/test?x=1', {}, '/test?x=1', { strict: true }, true],
      [null, '/test?x=1&y=2', {}, '/test?x=1&y=2', null, true],
      [null, '/test?y=2&&x=1', {}, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1', null, false],
      [null, '/test', { x: '/\\d+/', y: '2' }, '/test?x=1', { allowRegex: true }, false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1', { strict: true }, false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1&y=2', null, true],
      [null, '/test?y=2', { x: '1' }, '/test?x=1', null, false],
      [null, '/test?y=2', { x: '1' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1', y: '2' }, '/test?y=2&x=1', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', { strict: true }, false],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', null, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', { allowRegex: true }, true],
      [{ xOnly: { x: '/\\d+/' } }, '/test', ['xOnly'], '/test?x=1', { allowRegex: true }, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', { strict: true }, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=2', null, false],
      [{ xAndY: { x: '1', y: '2' } }, '/test', ['xAndY'], '/test?x=1&y=2', null, true],
      [{ xOnly: { x: '1' }, yOnly: { y: '2' } }, '/test', ['xOnly', 'yOnly'], '/test?x=1&y=2', null, true],
      [
        { xOnly: { x: '/\\d+/' }, yOnly: { y: '/\\d+/' } },
        '/test',
        ['xOnly', 'yOnly'],
        '/test?x=1&y=2',
        { allowRegex: true },
        true,
      ],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly', { y: '2' }], '/test?x=1&y=2', null, true],
    ])(
      'match query config="%o" matchPath="%s" matchValues="%o" path="%s" options="%o" result=%s',
      async (configuration, matchPath, matchValues, path, options, shouldMatch) => {
        const method = 'get'

        if (configuration) {
          await request
            .put('/___config')
            .send({
              query: configuration,
            })
            .expect(200)
        }

        await request
          .post('/___fixtures')
          .send({
            request: {
              path: matchPath,
              method,
              query: matchValues,
              ...(options
                ? {
                    options: {
                      query: options,
                    },
                  }
                : {}),
            },
            response: {
              body: {},
            },
          })
          .expect(201)

        await request[method](path).expect(shouldMatch ? 200 : 404)
      },
    )
  })

  describe('matching body', () => {
    test.each([
      [null, {}, {}, null, true],
      [null, [], {}, null, true],
      [null, {}, [], null, true],
      [null, [], [], null, true],
      [null, '', '', null, true],
      [null, { x: null }, { x: null }, null, true],
      [null, ['a', 'b'], ['a', 'b'], null, true],
      [null, ['a', 'b'], ['a', 'b'], { strict: true }, true],
      [null, ['a', 'b'], ['a', 'b'], { allowRegex: true }, true],
      [null, ['a', 'b'], ['b', 'a'], null, false],
      [null, ['a', 'b'], ['b', 'a'], { allowRegex: true }, false],
      [null, ['a', 'b'], ['b', 'a'], { strict: true }, false],
      [null, {}, { x: 'x' }, null, true],
      [null, {}, { x: 'x' }, { allowRegex: true }, true],
      [null, {}, { x: 'x' }, { strict: true }, false],
      [null, { x: 'x' }, { x: 'x' }, null, true],
      [null, { x: 'x' }, { x: 'x' }, { allowRegex: true }, true],
      [null, { x: '/x/' }, { x: 'x' }, { allowRegex: true }, true],
      [null, { x: 'x' }, { x: 'x' }, { strict: true }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, null, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, { allowRegex: true }, true],
      [null, { x: '/X/i' }, { x: 'x', other: 'other' }, { allowRegex: true }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, { strict: true }, false],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, null, false],
      [null, { a: { b: 'b' } }, { a: { b: 'b', c: 'c' } }, null, true],
      [null, { a: { b: 'b', c: [] } }, { a: { b: 'b', c: [] } }, null, true],
      [null, { a: { b: 'b', c: [] } }, { a: { b: 'b', c: [] } }, { allowRegex: true }, true],
      [null, { a: { b: '/B/i', c: [] } }, { a: { b: 'b', c: [] } }, { allowRegex: true }, true],
      [null, { a: { b: 'b', c: [] } }, { a: { b: 'b', c: [] } }, { strict: true }, true],
      [null, { a: { b: 'b', c: {} } }, { a: { b: 'b', c: [] } }, null, false],
      [null, { a: { b: 'b', c: {} } }, { a: { b: 'b' } }, null, false],
    ])(
      'match body config="%o" matchValues="%s" values="%o" options="%o" shouldMatch=%s',
      async (configuration, matchValues, values, options, shouldMatch) => {
        const path = '/test'
        const method = 'post'

        if (configuration) {
          await request
            .put('/___config')
            .send({
              body: configuration,
            })
            .expect(200)
        }

        await request
          .post('/___fixtures')
          .send({
            request: {
              path,
              method,
              body: matchValues,
              ...(options
                ? {
                    options: {
                      body: options,
                    },
                  }
                : {}),
            },
            response: {
              body: {},
            },
          })
          .expect(201)

        await request[method](path)
          .send(values)
          .expect(shouldMatch ? 200 : 404)
      },
    )
  })

  describe('lifetime option', () => {
    test.each([
      [[1], [[0, 200], 404]],
      [[2], [[0, 200], [0, 200], 404]],
      [
        [0],
        [
          [0, 200],
          [0, 200],
          [0, 200],
        ],
      ],
      [
        [1, 1],
        [[0, 200], [1, 200], 404],
      ],
      [
        [2, 1],
        [[0, 200], [0, 200], [1, 200], 404],
      ],
      [
        [1, 2],
        [[0, 200], [1, 200], [1, 200], 404],
      ],
      [
        [1, 1, 1],
        [[0, 200], [1, 200], [2, 200], 404],
      ],
    ])(
      'Option lifetime should match responses length, responseLifetimes=%j expectResponses=%j',
      async (responseLifetimes, expectResponses) => {
        await request
          .post('/___fixtures')
          .send({
            request: {
              path: '/',
              method: 'get',
            },
            responses: responseLifetimes.map((lifetime, i) => ({ body: `response-${i}`, options: { lifetime } })),
          })
          .expect(201)

        for (const expectResponse of expectResponses) {
          const r = request.get('/')

          if (Array.isArray(expectResponse)) {
            await r.expect(expectResponse[1], `response-${expectResponse[0]}`)
          } else {
            await r.expect(expectResponse)
          }
        }
      },
    )
  })

  describe('delay option', () => {
    test('delay response', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/',
            method: 'get',
          },
          response: {
            body: [],
            options: {
              delay: 1000,
            },
          },
        })
        .expect(201)

      // await request.get('/products').expect(200, [])
      // expect(setTimeout).toHaveBeenCalledTimes(1)
      // expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000)
    })
  })

  describe('responses', () => {
    test.each([
      [undefined, 200],
      [200, 200],
      [204, 204],
      [301, 301],
    ])('response status status="%n"', async (status, expectedStatus) => {
      await request.post('/___fixtures').send({
        request: {
          path: '/',
          method: 'get',
        },
        response: {
          status,
          body: '',
        },
      })

      await request.get('/').expect(expectedStatus)
    })

    test.each([
      ['headers', null, {}, {}],
      ['headers', null, { a: 'a' }, { a: 'a' }],
      ['headers', null, { a: 'a', b: 'b' }, { a: 'a', b: 'b' }],
      ['headers', null, [{ a: 'a' }], { a: 'a' }],
      ['headers', null, [{ a: 'a' }, { b: 'b' }], { a: 'a', b: 'b' }],
      ['headers', { A: { a: 'a' } }, ['A'], { a: 'a' }],
      ['headers', { A: { a: 'a' } }, ['A', { a: 'a' }], { a: 'a' }],
      ['headers', { A: { a: 'a' } }, ['A', { b: 'b' }], { a: 'a', b: 'b' }],
      ['headers', { A: { a: 'a' }, B: { b: 'b' } }, ['A', 'B'], { a: 'a', b: 'b' }],
      ['headers', { A: { a: 'a' }, C: { c: 'c' } }, ['A', { b: 'b' }, 'C'], { a: 'a', b: 'b', c: 'c' }],
      ['cookies', null, {}, {}],
      ['cookies', undefined, { a: 'a' }, { a: 'a' }],
      ['cookies', undefined, { a: 'a', b: 'b' }, { a: 'a', b: 'b' }],
      ['cookies', undefined, [{ a: 'a' }], { a: 'a' }],
      ['cookies', undefined, [{ a: 'a' }, { b: 'b' }], { a: 'a', b: 'b' }],
      ['cookies', { A: { a: 'a' } }, ['A'], { a: 'a' }],
      ['cookies', { A: { a: 'a' } }, ['A', { a: 'a' }], { a: 'a' }],
      ['cookies', { A: { a: 'a' } }, ['A', { b: 'b' }], { a: 'a', b: 'b' }],
      ['cookies', { A: { a: 'a' }, B: { b: 'b' } }, ['A', 'B'], { a: 'a', b: 'b' }],
      ['cookies', { A: { a: 'a' }, C: { c: 'c' } }, ['A', { b: 'b' }, 'C'], { a: 'a', b: 'b', c: 'c' }],
    ])(
      'response %s configHeaders="%o" propertyValue="%o" expectedPropertyValue="%o"',
      async (property, configuration, propertyValue, expectedPropertyValue) => {
        if (configuration) {
          await request
            .put('/___config')
            .send({
              [property]: configuration,
            })
            .expect(200)
        }

        await request.post('/___fixtures').send({
          request: {
            path: '/',
            method: 'get',
          },
          response: {
            [property]: propertyValue,
            body: '',
          },
        })

        const r = request.get('/').expect(200)

        if (property === 'headers') {
          for (const key in expectedPropertyValue) {
            // @ts-ignore
            r.expect(key, expectedPropertyValue[key])
          }
        } else {
          const cookieValue = []

          for (const key in expectedPropertyValue) {
            // @ts-ignore
            cookieValue.push(`${key}=${expectedPropertyValue[key]}; Path=/`)
          }

          if (cookieValue.length) {
            r.expect('set-cookie', cookieValue.join(','))
          }
        }

        await r
      },
    )
  })
})
