jest.useFakeTimers()

describe('integrations.js', () => {
  const { dirname } = require('node:path')

  let server
  let request

  beforeAll((done) => {
    jest.mock('fs', () => {
      const mockFs = new (require('metro-memory-fs'))()
      mockFs.ReadStream = class {} // This fix an error with destroy package
      return mockFs
    })
    require('node:fs').reset()

    const supertest = require('supertest')
    const app = require('../createServer')()

    server = app.listen(done)
    request = supertest.agent(server)
  })

  afterEach(async () => Promise.all([request.delete('/___config'), request.delete('/___fixtures')]))

  afterAll((done) => {
    server.close(done)
    server = null
  })

  describe('manipulate configuration', () => {
    test('default configuration', () =>
      request.get('/___config').expect(200, {
        cors: null,
        headers: {},
        query: {},
        cookies: {},
      }))

    test('update configuration', async () => {
      await request
        .put('/___config')
        .send({
          headers: {
            commonHeaders: {
              'x-header-1': '1',
              'x-header-2': '2',
            },
          },
        })
        .expect(200)

      await request
        .put('/___config')
        .send({
          cors: '*',
          headers: {
            clientToken: {
              authorization: 'Bearer client-token',
            },
          },
          cookies: {},
        })
        .expect(200)

      return request.get('/___config').expect(200, {
        cors: '*',
        headers: {
          commonHeaders: {
            'x-header-1': '1',
            'x-header-2': '2',
          },
          clientToken: {
            authorization: 'Bearer client-token',
          },
        },
        query: {},
        cookies: {},
      })
    })

    test('reset configuration', async () => {
      await request.delete('/___config').expect(204)
    })

    test.each([
      // valid
      [{}, true],
      [{ cors: '*', headers: {}, cookies: {}, query: {} }, true],
      [{ cors: null, headers: {}, cookies: {}, query: {} }, true],

      // invalid
      [[], false],
      [{ unknown: 'unknown' }, false],
      [{ headers: [] }, false],
    ])('validate config="%o" response="%o" options="%o" isValid=%s', (config, isValid) => {
      return request
        .put('/___config')
        .send(config)
        .expect(isValid ? 200 : 400)
    })
  })

  describe('validation fixture', () => {
    test.each([
      // request path / method
      [{}, { body: '' }, false],
      [{ unknown: 'unknown' }, { body: '' }, false],
      [{ method: 'get' }, { body: '' }, false],
      [{ path: '/' }, { body: '' }, false],
      [{ path: '/' }, { body: '' }, false],

      [{ path: '/', method: 'unknown' }, { body: '' }, false],
      [{ path: '/', method: 'head' }, { body: '' }, true],
      [{ path: '/', method: 'HEAD' }, { body: '' }, true],
      [{ path: '/', method: 'delete' }, { body: '' }, true],
      [{ path: '/', method: 'put' }, { body: '' }, true],
      [{ path: '/', method: 'post' }, { body: '' }, true],
      [{ path: '/', method: 'get' }, { body: '' }, true],
      [{ path: '/', method: 'options' }, { body: '' }, true],
      [{ path: '/', method: 'patch' }, { body: '' }, true],

      // request body
      [{ method: 'get', path: '/', body: '' }, { body: '' }, true],
      [{ method: 'get', path: '/', body: {} }, { body: '' }, true],
      [{ method: 'get', path: '/', body: 1 }, { body: '' }, true],
      [{ method: 'get', path: '/', body: [] }, { body: '' }, true],

      // request headers
      [{ method: 'get', path: '/', headers: {} }, { body: '' }, true],
      [{ method: 'get', path: '/', headers: null }, { body: '' }, false],
      [{ method: 'get', path: '/', headers: { a: 'b' } }, { body: '' }, true],
      [{ method: 'get', path: '/', headers: [] }, { body: '' }, true],
      [{ method: 'get', path: '/', headers: [1] }, { body: '' }, false],
      [{ method: 'get', path: '/', headers: ['not-in-configuration'] }, { body: '' }, false],

      // request options path
      [{ path: '/', method: 'get', options: { path: { allowRegex: true } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { path: { strict: true } } }, { body: '' }, false],

      // request options method
      [{ path: '/', method: 'get', options: { method: { allowRegex: true } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { method: { strict: true } } }, { body: '' }, false],

      // request options headers
      [{ path: '/', method: 'get', options: { headers: { strict: true, allowRegex: true } } }, { body: '' }, false],
      [{ path: '/', method: 'get', options: { headers: { strict: true, allowRegex: false } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { headers: { strict: false, allowRegex: false } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { headers: { strict: true } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { headers: { strict: false, allowRegex: true } } }, { body: '' }, true],
      [{ path: '/', method: 'get', options: { headers: { allowRegex: true } } }, { body: '' }, true],
    ])('validate request="%o" response="%o" isValid=%s', async (req, resp, isValid) => {
      await request
        .post('/___fixtures')
        .send({ request: req, response: resp })
        .expect(isValid ? 201 : 400)

      // Same error in bulk
      if (!isValid) {
        await request
          .post('/___fixtures/bulk')
          .send([{ request: { method: 'get', path: '/' } }, { request: req, response: resp }])
          .expect(400)
      }
    })
  })

  describe('create and delete fixtures', () => {
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

    test('create and remove simple fixture', async () => {
      const products = [{ id: 1 }, { id: 2 }]

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get',
          },
          response: {
            status: 418,
            body: products,
            options: {
              lifetime: 2,
            },
          },
        })
        .expect(201, {
          id: '6a68271761e4729581283c2b40b7e428c25513cf',
        })

      await request.get('/products').expect(418, products)

      await request.delete('/___fixtures/6a68271761e4729581283c2b40b7e428c25513cf').expect(204)

      await request.get('/products').expect(404)
    })

    test('create and remove multiple fixtures', async () => {
      const products = [{ id: 1 }, { id: 2 }]
      const categories = [{ id: 1 }, { id: 2 }]

      await request
        .post('/___fixtures/bulk')
        .send([
          {
            request: {
              path: '/products',
              method: 'get',
            },
            response: {
              body: products,
              options: {
                lifetime: 2,
              },
            },
          },
          {
            request: {
              path: '/categories',
              method: 'get',
            },
            response: {
              body: categories,
              options: {
                lifetime: 2,
              },
            },
          },
        ])
        .expect(201, [
          { id: '6a68271761e4729581283c2b40b7e428c25513cf' },
          { id: '1b8b0bca022acacfd5955c510e06e1ff671a823c' },
        ])

      await Promise.all([
        request.get('/products').expect(200, products),
        request.get('/categories').expect(200, categories),
      ])

      await Promise.all([
        request.delete('/___fixtures/6a68271761e4729581283c2b40b7e428c25513cf').expect(204),
        request.delete('/___fixtures/1b8b0bca022acacfd5955c510e06e1ff671a823c').expect(204),
      ])

      await Promise.all([request.get('/products').expect(404), request.get('/categories').expect(404)])
    })

    test('create and remove all fixtures', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/octopus',
            method: 'get',
          },
          response: {
            body: [],
          },
        })
        .expect(201, {
          id: 'eb05231114f144acb7bca60806ac25ad7f43c973',
        })
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/giraffes',
            method: 'get',
          },
          response: {
            body: [],
          },
        })
        .expect(201, {
          id: '66474236616bc5a68c6498b497b2ce9a43484892',
        })

      await request.delete('/___fixtures').expect(204)

      await request.get('/octopus').expect(404, {})

      await request.get('/giraffes').expect(404, {})
    })

    test('create and remove filepath fixture', async () => {
      const fs = require('node:fs')
      const file = '/tmp/panda.txt'

      fs.mkdirSync(dirname(file))
      fs.writeFileSync(file, 'pandas !')

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
          id: 'd8a1f72e9cd206c612847a7089e8c9460648c4bf',
        })

      await request
        .get('/panda.txt')
        .expect('Content-Type', /text\/plain/)
        .expect(200, 'pandas !')

      await request.delete('/___fixtures/d8a1f72e9cd206c612847a7089e8c9460648c4bf').expect(204)

      await request.get('/panda.txt').expect(404)
    })
  })

  describe('conflicts fixtures', () => {
    test.each([
      // Conflicts
      [null, { method: 'get', path: '/products' }, { method: 'get', path: '/products' }, true],
      [
        null,
        { method: 'get', path: '/products', headers: {}, cookies: {}, query: {} },
        { method: 'get', path: '/products' },
        true,
      ],
      [
        null,
        { method: 'get', path: '/products', headers: { a: 'a' }, cookies: { a: 'a' } },
        { method: 'get', path: '/products', cookies: { a: 'a' }, headers: { a: 'a' } },
        true,
      ],
      [
        null,
        { method: 'get', path: '/products', headers: [], cookies: [], query: [] },
        { method: 'get', path: '/products' },
        true,
      ],
      [
        null,
        {
          method: 'get',
          path: '/products',
          headers: { a: 'a', b: 'b' },
          cookies: { a: 'a', b: 'b' },
          query: { a: 'a', b: 'b' },
        },
        {
          method: 'get',
          path: '/products',
          headers: { b: 'b', a: 'a' },
          cookies: { a: 'a', b: 'b' },
          query: { a: 'a', b: 'b' },
        },
        true,
      ],
      // No conflicts
      [null, { method: 'get', path: '/products' }, { method: 'post', path: '/products' }, false],
      [null, { method: 'post', path: '/products' }, { method: 'get', path: '/products' }, false],
      [null, { method: 'get', path: '/products' }, { method: 'get', path: '/categories' }, false],
      [null, { method: 'get', path: '/categories' }, { method: 'get', path: '/products' }, false],
    ])(
      'conflict situation config="%o" requestA="%o" requestB="%o" shouldConflict=%s',
      async (configuration, requestA, requestB, shouldConflict) => {
        if (configuration) {
          await request
            .put('/___config')
            .send({
              headers: configuration,
            })
            .expect(200)
        }

        // Check if combining fixtures in a single request also failed
        await request
          .post('/___fixtures/bulk')
          .send(
            [requestA, requestB].map((request) => ({
              request: request,
              response: {
                body: {},
              },
            })),
          )
          .expect(shouldConflict ? 409 : 201)

        if (!shouldConflict) {
          await request.delete('/___fixtures')
        }

        await request
          .post('/___fixtures')
          .send({
            request: requestA,
            response: {
              body: {},
            },
          })
          .expect(201)

        await request
          .post('/___fixtures')
          .send({
            request: requestB,
            response: {
              body: {},
            },
          })
          .expect(shouldConflict ? 409 : 201)
      },
    )
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

        await request[method](path)
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
      ['/a', null, '/a', true],
      ['*', null, '/a', true],
      ['*', null, '/a/b', true],
      ['/a', null, '/a/', false],
      ['/a/', null, '/a', false],
      ['/a/b', null, '/a/b', true],
      ['/a/b', null, '/a', false],
      ['/a/b', null, '/b', false],
      ['/a/b', null, '/a/', false],
      ['/a/b', null, '/b/', false],
      ['//a/', { allowRegex: true }, '/a', true],
      ['//a/', { allowRegex: true }, '/a/b', true],
      ['/^/a/', { allowRegex: true }, '/a/b', true],
      ['/^/a$/', { allowRegex: true }, '/a/b', false],
      ['/^(/(a|b))+$/', { allowRegex: true }, '/a/b', true],
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

      await request
        // eslint-disable-next-line no-unexpected-multiline
        [method](path)
        .expect(shouldMatch ? 200 : 404)
    })
  })

  describe('matching method', () => {
    test.each([
      ['get', null, 'get', true],
      ['post', null, 'post', true],
      ['*', null, 'get', true],
      ['*', null, 'post', true],
      ['/(get|post)/', { allowRegex: true }, 'get', true],
      ['/(get|post)/', { allowRegex: true }, 'post', true],
    ])(
      'matching method match="%s" options="%o" test="%s" result=%s',
      async (matchMethod, options, method, shouldMatch) => {
        const path = '/test'

        await request
          .post('/___fixtures')
          .send({
            request: {
              path,
              method: matchMethod,
              ...(options
                ? {
                    options: {
                      method: options,
                    },
                  }
                : {}),
            },
            response: {
              body: '',
            },
          })
          .expect(201)

        await request
          // eslint-disable-next-line no-unexpected-multiline
          [method](path)
          .expect(shouldMatch ? 200 : 404)
      },
    )
  })

  describe('matching headers', () => {
    test.each([
      [null, { a: 'a' }, null, { a: 'a' }, true],
      [null, { a: 'a' }, null, { A: 'a' }, true],
      [null, { A: 'a' }, null, { a: 'a' }, true],
      [null, { a: 1 }, null, { a: '1' }, true],
      [null, { a: [] }, null, { a: '[]' }, true],
      [null, { a: { b: 'b' } }, null, { a: '{"b":"b"}' }, true],
      [null, { a: null }, null, { a: 'null' }, true],
      [null, { a: 'a' }, { allowRegex: true }, { a: 'a' }, true],
      [null, { a: '/a/' }, { allowRegex: true }, { a: 'a' }, true],
      [null, { a: '/A/' }, { allowRegex: true }, { a: 'a' }, false],
      [null, { a: '/A/ig' }, { allowRegex: true }, { a: 'a' }, true],
      [null, { a: 'a' }, null, { a: 'a', b: 'b' }, true],
      [null, { a: '/a/' }, { allowRegex: true }, { a: 'a', b: 'b' }, true],
      [null, { a: 'a', b: 'b' }, null, { a: 'a' }, false],
      [null, { a: '/a/', b: 'b' }, { allowRegex: true }, { a: 'a' }, false],
      [{ custom: { a: 'a' } }, ['custom'], null, {}, false],
      [{ custom: { a: '/a/' } }, ['custom'], { allowRegex: true }, {}, false],
      [{ custom: { a: 'a' } }, ['custom'], null, { a: 'a' }, true],
      [{ custom: { a: '/a/' } }, ['custom'], { allowRegex: true }, { a: 'a' }, true],
      [{ custom: { a: 'a', b: 'b' } }, ['custom'], null, { a: 'a' }, false],
      [{ custom: { a: '/a/', b: '/b/' } }, ['custom'], { allowRegex: true }, { a: 'a' }, false],
      [{ custom: { a: 'a', b: 'b' } }, ['custom'], null, { a: 'a', b: 'b' }, true],
      [{ a: { a: 'a' }, b: { b: 'b' } }, ['a', 'b'], null, { a: 'a' }, false],
      [{ a: { a: 'a' }, b: { b: 'b' } }, ['a', 'b'], null, { a: 'a', b: 'b' }, true],
    ])(
      'match headers config="%o" match="%o" options="%o" result=%s',
      async (configuration, matchValues, options, values, shouldMatch) => {
        const path = '/test'
        const method = 'get'

        if (configuration) {
          await request
            .put('/___config')
            .send({
              headers: configuration,
            })
            .expect(200)
        }

        await request
          .post('/___fixtures')
          .send({
            request: {
              path,
              method,
              headers: matchValues,
              ...(options
                ? {
                    options: {
                      headers: options,
                    },
                  }
                : {}),
            },
            response: {
              body: '',
            },
          })
          .expect(201)

        await request
          // eslint-disable-next-line no-unexpected-multiline
          [method](path)
          .set(values)
          .expect(shouldMatch ? 200 : 404)
      },
    )
  })

  describe('matching cookies', () => {
    test.each([
      [null, { x: 'x' }, { x: 'x' }, null, true],
      [null, { x: 1 }, { x: '1' }, null, true],
      [null, { x: [] }, { x: '[]' }, null, true],
      [null, { x: { y: 'y' } }, { x: '{"y":"y"}' }, null, true],
      [null, { x: 'x' }, { x: 'x' }, { strict: false }, true],
      [null, { x: 'x' }, { x: 'x' }, { allowRegex: true }, true],
      [null, { x: '/x/' }, { x: 'x' }, { allowRegex: true }, true],
      [null, { x: 'x' }, { x: 'x' }, { strict: true }, true],
      [null, { x: 'x' }, { x: 'x', y: 'y' }, { strict: true }, false],
      [null, { x: 'x', y: 'y' }, { x: 'x' }, { strict: true }, false],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, null, true],
      [null, { x: '/x/' }, { x: 'x', other: 'other' }, { allowRegex: true }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, { strict: true }, false],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, null, false],
      [null, { x: '/x/', other: 'other' }, { x: 'x' }, { allowRegex: true }, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], {}, null, false],
      [{ xOnly: { x: '/x/' } }, ['xOnly'], {}, { allowRegex: true }, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], { x: 'x' }, null, true],
      [{ xOnly: { x: '/X/i' } }, ['xOnly'], { x: 'x' }, { allowRegex: true }, true],
      [{ xOnly: { x: 'x' } }, ['xOnly'], { x: 'x' }, { strict: true }, true],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x' }, null, false],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x', y: 'y' }, null, true],
      [{ xAndY: { x: '/X/ig', y: '/Y/ig' } }, ['xAndY'], { x: 'x', y: 'y' }, { allowRegex: true }, true],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x', y: 'y' }, { strict: true }, true],
      [{ xOnly: { x: 'x' }, yOnly: { y: 'y' } }, ['xOnly', 'yOnly'], { x: 'x' }, null, false],
      [{ xOnly: { x: 'x' }, yOnly: { y: 'y' } }, ['xOnly', 'yOnly'], { x: 'x', y: 'y' }, null, true],
      [{ xOnly: { x: 'x' } }, ['xOnly', { y: 'y' }], { x: 'x', y: 'y' }, null, true],
    ])(
      'match cookies config=%o match=%o request=%o result=%s',
      async (configuration, matchValues, values, options, shouldMatch) => {
        const path = '/test'
        const method = 'get'

        if (configuration) {
          await request
            .put('/___config')
            .send({
              cookies: configuration,
            })
            .expect(200)
        }

        await request
          .post('/___fixtures')
          .send({
            request: {
              path,
              method,
              cookies: matchValues,
              ...(options
                ? {
                    options: {
                      cookies: options,
                    },
                  }
                : {}),
            },
            response: {
              body: '',
            },
          })
          .expect(201)

        const cookies = Object.entries(values)
          .reduce((acc, [key, value]) => {
            acc.push(`${key}=${value}`)
            return acc
          }, [])
          .join(';')

        await request[method](path)
          .set('Cookie', cookies)
          .expect(shouldMatch ? 200 : 404)
      },
    )
  })

  describe('matching query', () => {
    test.each([
      [null, '/test', { x: '1' }, '/test', null, false],
      [null, '/test', { x: '1' }, '/test', { strict: false }, false],
      [null, '/test', { x: '1' }, '/test', { allowRegex: true }, false],
      [null, '/test', { x: '1' }, '/test', { strict: true }, false],
      [null, '/test', { x: '1' }, '/test?x=1', null, true],
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

        await request
          // eslint-disable-next-line no-unexpected-multiline
          [method](path)
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
            r.expect(key, expectedPropertyValue[key])
          }
        } else {
          const cookieValue = []

          for (const key in expectedPropertyValue) {
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
