jest.useFakeTimers()

describe('integrations.js', () => {
  const { dirname } = require('path')

  let server
  let request

  beforeAll(function (done) {
    jest.mock('fs', () => {
      const mockFs = new (require('metro-memory-fs'))()
      mockFs.ReadStream = class {} // This fix an error with destroy package
      return mockFs
    })
    require('fs').reset()

    const supertest = require('supertest')
    const app = require('../createServer')()

    server = app.listen(done)
    request = supertest.agent(server)
  })

  afterEach(async function () {
    return Promise.all([request.delete('/___config'), request.delete('/___fixtures')])
  })

  afterAll(function (done) {
    server.close(done)
    server = null
  })

  describe('manipulate configuration', () => {
    test('default configuration', () =>
      request.get('/___config').expect(200, {
        headers: {},
        query: {},
        cookies: {}
      }))

    test('update configuration', async () => {
      await request
        .put('/___config')
        .send({
          headers: {
            serverCors: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': '*'
            }
          }
        })
        .expect(200)

      await request
        .put('/___config')
        .send({
          headers: {
            clientToken: {
              authorization: 'Bearer client-token'
            }
          },
          cookies: {}
        })
        .expect(200)

      return request.get('/___config').expect(200, {
        headers: {
          serverCors: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*'
          },
          clientToken: {
            authorization: 'Bearer client-token'
          }
        },
        query: {},
        cookies: {}
      })
    })

    test('reset configuration', async () => {
      await request.delete('/___config').expect(204)
    })

    test.each([
      // valid
      [{}, true],
      [{ headers: {}, cookies: {}, query: {} }, true],

      // invalid
      [[], false],
      [{ unknown: 'unknown' }, false],
      [{ headers: [] }, false]
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
      [{}, { body: '' }, undefined, false],
      [{ unknown: 'unknown' }, { body: '' }, undefined, false],
      [{ method: 'get' }, { body: '' }, undefined, false],
      [{ path: '/' }, { body: '' }, undefined, false],
      [{ path: '/' }, { body: '' }, undefined, false],

      [{ path: '/', method: 'unknown' }, { body: '' }, undefined, false],
      [{ path: '/', method: 'head' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'HEAD' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'delete' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'put' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'post' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'get' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'options' }, { body: '' }, undefined, true],
      [{ path: '/', method: 'patch' }, { body: '' }, undefined, true],

      // request body
      [{ method: 'get', path: '/', body: '' }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', body: {} }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', body: 1 }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', body: [] }, { body: '' }, undefined, true],

      // request headers
      [{ method: 'get', path: '/', headers: {} }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', headers: null }, { body: '' }, undefined, false],
      [{ method: 'get', path: '/', headers: { a: 'b' } }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', headers: [] }, { body: '' }, undefined, true],
      [{ method: 'get', path: '/', headers: [1] }, { body: '' }, undefined, false],
      [{ method: 'get', path: '/', headers: ['not-in-configuration'] }, { body: '' }, undefined, false]
    ])('validate request="%o" response="%o" options="%o" isValid=%s', async (req, resp, options, isValid) => {
      await request
        .post('/___fixtures')
        .send({ request: req, response: resp, options })
        .expect(isValid ? 201 : 400)

      // Same error in bulk
      if (!isValid) {
        await request
          .post('/___fixtures/bulk')
          .send([{ request: { method: 'get', path: '/' } }, { request: req, response: resp, options }])
          .expect(400)
      }
    })
  })

  describe('create and delete fixtures', () => {
    test('create and remove simple fixture', async () => {
      const products = [{ id: 1 }, { id: 2 }]

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get'
          },
          response: {
            status: 418,
            body: products
          },
          options: {
            lifetime: 2
          }
        })
        .expect(201, {
          id: '6a68271761e4729581283c2b40b7e428c25513cf'
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
              method: 'get'
            },
            response: {
              body: products
            },
            options: {
              lifetime: 2
            }
          },
          {
            request: {
              path: '/categories',
              method: 'get'
            },
            response: {
              body: categories
            },
            options: {
              lifetime: 2
            }
          }
        ])
        .expect(201, [{ id: '6a68271761e4729581283c2b40b7e428c25513cf' }, { id: '1b8b0bca022acacfd5955c510e06e1ff671a823c' }])

      await Promise.all([request.get('/products').expect(200, products), request.get('/categories').expect(200, categories)])

      await Promise.all([
        request.delete('/___fixtures/6a68271761e4729581283c2b40b7e428c25513cf').expect(204),
        request.delete('/___fixtures/1b8b0bca022acacfd5955c510e06e1ff671a823c').expect(204)
      ])

      await Promise.all([request.get('/products').expect(404), request.get('/categories').expect(404)])
    })

    test('create and remove all fixtures', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/octopus',
            method: 'get'
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: 'eb05231114f144acb7bca60806ac25ad7f43c973'
        })
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/giraffes',
            method: 'get'
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: '66474236616bc5a68c6498b497b2ce9a43484892'
        })

      await request.delete('/___fixtures').expect(204)

      await request.get('/octopus').expect(404, {})

      await request.get('/giraffes').expect(404, {})
    })

    test('create and remove filepath fixture', async () => {
      const fs = require('fs')
      const file = '/tmp/panda.txt'

      fs.mkdirSync(dirname(file))
      fs.writeFileSync(file, 'pandas !')

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/panda.txt',
            method: 'get'
          },
          response: {
            filepath: file
          }
        })
        .expect(201, {
          id: 'd8a1f72e9cd206c612847a7089e8c9460648c4bf'
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
      [null, { method: 'get', path: '/products', headers: {}, cookies: {}, query: {} }, { method: 'get', path: '/products' }, true],
      [
        null,
        { method: 'get', path: '/products', headers: { a: 'a' }, cookies: { a: 'a' } },
        { method: 'get', path: '/products', cookies: { a: 'a' }, headers: { a: 'a' } },
        true
      ],
      [null, { method: 'get', path: '/products', headers: [], cookies: [], query: [] }, { method: 'get', path: '/products' }, true],
      [
        null,
        { method: 'get', path: '/products', headers: { a: 'a', b: 'b' }, cookies: { a: 'a', b: 'b' }, query: { a: 'a', b: 'b' } },
        { method: 'get', path: '/products', headers: { b: 'b', a: 'a' }, cookies: { a: 'a', b: 'b' }, query: { a: 'a', b: 'b' } },
        true
      ],
      // No conflicts
      [null, { method: 'get', path: '/products' }, { method: 'post', path: '/products' }, false],
      [null, { method: 'post', path: '/products' }, { method: 'get', path: '/products' }, false],
      [null, { method: 'get', path: '/products' }, { method: 'get', path: '/categories' }, false],
      [null, { method: 'get', path: '/categories' }, { method: 'get', path: '/products' }, false]
    ])('conflict situation config="%o" requestA="%o" requestB="%o" shouldConflict=%s', async (configuration, requestA, requestB, shouldConflict) => {
      if (configuration) {
        await request
          .put('/___config')
          .send({
            headers: configuration
          })
          .expect(200)
      }

      // Check if combining fixtures in a single request also failed
      await request
        .post('/___fixtures/bulk')
        .send(
          [requestA, requestB].map(request => ({
            request: request,
            response: {
              body: {}
            }
          }))
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
            body: {}
          }
        })
        .expect(201)

      await request
        .post('/___fixtures')
        .send({
          request: requestB,
          response: {
            body: {}
          }
        })
        .expect(shouldConflict ? 409 : 201)
    })
  })

  describe('matching headers', () => {
    test.each([
      [null, { x: 'y' }, { x: 'y' }, true],
      [null, { x: 'y' }, { x: 'y', other: 'other' }, true],
      [null, { x: 'y', other: 'other' }, { x: 'y' }, false],
      [{ custom: { a: 'a' } }, ['custom'], {}, false],
      [{ custom: { a: 'a' } }, ['custom'], { a: 'a' }, true],
      [{ custom: { a: 'a', b: 'b' } }, ['custom'], { a: 'a' }, false],
      [{ custom: { a: 'a', b: 'b' } }, ['custom'], { a: 'a', b: 'b' }, true],
      [{ a: { a: 'a' }, b: { b: 'b' } }, ['a', 'b'], { a: 'a' }, false],
      [{ a: { a: 'a' }, b: { b: 'b' } }, ['a', 'b'], { a: 'a', b: 'b' }, true]
    ])('match headers config="%o" match="%o" request="%o" result=%s', async (configuration, matchValues, values, shouldMatch) => {
      const path = '/test'
      const method = 'get'

      if (configuration) {
        await request
          .put('/___config')
          .send({
            headers: configuration
          })
          .expect(200)
      }

      await request
        .post('/___fixtures')
        .send({
          request: {
            path,
            method,
            headers: matchValues
          },
          response: {
            body: ''
          }
        })
        .expect(201)

      await request
        // eslint-disable-next-line no-unexpected-multiline
        [method](path)
        .set(values)
        .expect(shouldMatch ? 200 : 404)
    })
  })

  describe('matching cookies', () => {
    test.each([
      [null, { x: 'x' }, { x: 'x' }, null, true],
      [null, { x: 'x' }, { x: 'x' }, { strict: true }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, null, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, { strict: true }, false],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, null, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], {}, null, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], { x: 'x' }, null, true],
      [{ xOnly: { x: 'x' } }, ['xOnly'], { x: 'x' }, { strict: true }, true],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x' }, null, false],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x', y: 'y' }, null, true],
      [{ xOnly: { x: 'x' }, yOnly: { y: 'y' } }, ['xOnly', 'yOnly'], { x: 'x' }, null, false],
      [{ xOnly: { x: 'x' }, yOnly: { y: 'y' } }, ['xOnly', 'yOnly'], { x: 'x', y: 'y' }, null, true],
      [{ xOnly: { x: 'x' } }, ['xOnly', { y: 'y' }], { x: 'x', y: 'y' }, null, true]
    ])('match cookies config="%o" match="%s %o" request="%s %o" result=%s', async (configuration, matchValues, values, options, shouldMatch) => {
      const path = '/test'
      const method = 'get'

      if (configuration) {
        await request
          .put('/___config')
          .send({
            cookies: configuration
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
                  cookies: options
                }
              }
              : {})
          },
          response: {
            body: ''
          }
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
    })
  })

  describe('matching query', () => {
    test.each([
      [null, '/test', { x: '1' }, '/test', null, false],
      [null, '/test', { x: '1' }, '/test', { strict: true }, false],
      [null, '/test', { x: '1' }, '/test?x=1', null, true],
      [null, '/test', { x: '1' }, '/test?x=1', { strict: true }, true],
      [null, '/test', { x: '1' }, '/test?x=2', null, false],
      [null, '/test?x=1', undefined, '/test?x=1', null, true],
      [null, '/test?x=1&y=2', undefined, '/test?x=1&y=2', null, true],
      [null, '/test?y=2&&x=1', undefined, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1', null, false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1&y=2', null, true],
      [null, '/test?y=2', { x: '1' }, '/test?x=1', null, false],
      [null, '/test?y=2', { x: '1' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1', y: '2' }, '/test?y=2&x=1', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', { strict: true }, false],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', null, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=2', null, false],
      [{ xAndY: { x: '1', y: '2' } }, '/test', ['xAndY'], '/test?x=1&y=2', null, true],
      [{ xOnly: { x: '1' }, yOnly: { y: '2' } }, '/test', ['xOnly', 'yOnly'], '/test?x=1&y=2', null, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly', { y: '2' }], '/test?x=1&y=2', null, true]
    ])('match query config="%o" match="%s %o" request="%s %o" result=%s', async (configuration, matchPath, matchValues, path, options, shouldMatch) => {
      const method = 'get'

      if (configuration) {
        await request
          .put('/___config')
          .send({
            query: configuration
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
                  query: options
                }
              }
              : {})
          },
          response: {
            body: {}
          }
        })
        .expect(201)

      await request[method](path).expect(shouldMatch ? 200 : 404)
    })
  })

  describe('matching body', () => {
    test.each([
      [null, {}, {}, true],
      [null, [], {}, true],
      [null, {}, [], true],
      [null, [], [], true],
      [null, '', '', true],
      [null, { x: null }, { x: null }, true],
      [null, ['a', 'b'], ['a', 'b'], true],
      [null, ['a', 'b'], ['b', 'a'], false],
      [null, {}, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, true],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, false],
      [null, { a: { b: 'b' } }, { a: { b: 'b', c: 'c' } }, true],
      [null, { a: { b: 'b', c: [] } }, { a: { b: 'b', c: [] } }, true],
      [null, { a: { b: 'b', c: {} } }, { a: { b: 'b', c: [] } }, false],
      [null, { a: { b: 'b', c: {} } }, { a: { b: 'b' } }, false]
    ])('match body config="%o" match="%s" request="%o" result=%s', async (configuration, matchValues, values, shouldMatch) => {
      const path = '/test'
      const method = 'post'

      if (configuration) {
        await request
          .put('/___config')
          .send({
            body: configuration
          })
          .expect(200)
      }

      await request
        .post('/___fixtures')
        .send({
          request: {
            path,
            method,
            body: matchValues
          },
          response: {
            body: {}
          }
        })
        .expect(201)

      await request
        // eslint-disable-next-line no-unexpected-multiline
        [method](path)
        .send(values)
        .expect(shouldMatch ? 200 : 404)
    })
  })

  describe('lifetime option', () => {
    test('the fixture should be consumed once', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get'
          },
          response: {
            body: ''
          }
        })
        .expect(201)

      await request.get('/products').expect(200)
      await request.get('/products').expect(404)

      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get'
          },
          response: {
            body: ''
          },
          options: {
            lifetime: 1
          }
        })
        .expect(201)

      await request.get('/products').expect(200)
      await request.get('/products').expect(404)
    })

    test('the fixture should be consumed twice', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get'
          },
          response: {
            body: ''
          },
          options: {
            lifetime: 2
          }
        })
        .expect(201)

      await request.get('/products').expect(200)
      await request.get('/products').expect(200)
      await request.get('/products').expect(404)
    })

    test('the fixture can be consumed in unlimited', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
            method: 'get'
          },
          response: {
            body: ''
          },
          options: {
            lifetime: 0
          }
        })
        .expect(201)

      for (let i = 0; i < 10; i++) {
        await request.get('/products').expect(200)
      }
    })
  })

  describe('delay option', () => {
    test('delay response', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/',
            method: 'get'
          },
          response: {
            body: [],
            options: {
              delay: 1000
            }
          }
        })
        .expect(201)

      // await request.get('/products').expect(200, [])
      // expect(setTimeout).toHaveBeenCalledTimes(1)
      // expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000)
    })
  })

  describe('reponses', () => {
    test.each([[undefined, 200], [200, 200], [204, 204], [301, 301]])('response status status="%n"', async (status, expectedStatus) => {
      await request.post('/___fixtures').send({
        request: {
          path: '/',
          method: 'get'
        },
        response: {
          status,
          body: ''
        }
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
      ['cookies', { A: { a: 'a' }, C: { c: 'c' } }, ['A', { b: 'b' }, 'C'], { a: 'a', b: 'b', c: 'c' }]
    ])(
      'response %s configHeaders="%o" propertyValue="%o" expectedPropertyValue="%o"',
      async (property, configuration, propertyValue, expectedPropertyValue) => {
        if (configuration) {
          await request
            .put('/___config')
            .send({
              [property]: configuration
            })
            .expect(200)
        }

        await request.post('/___fixtures').send({
          request: {
            path: '/',
            method: 'get'
          },
          response: {
            [property]: propertyValue,
            body: ''
          }
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
      }
    )
  })
})
