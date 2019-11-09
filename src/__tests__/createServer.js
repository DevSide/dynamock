describe('createServer.js', () => {
  jest.useFakeTimers()

  const supertest = require('supertest')
  const { dirname } = require('path')

  let request
  let server
  let app

  beforeEach(function (done) {
    jest.mock('fs', () => {
      const mockFs = new (require('metro-memory-fs'))()
      mockFs.ReadStream = class {} // This fix an error with destroy package
      return mockFs
    })
    require('fs').reset()

    app = require('../createServer')()
    server = app.listen(done)
    request = supertest.agent(server)
  })

  afterEach(function (done) {
    server.close(done)
    server = null
  })

  describe('manipulate configuration', () => {
    test('default configuration', () =>
      request.get('/___config').expect(200, {
        paths: {},
        methods: {},
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
        paths: {},
        methods: {},
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
  })

  describe('create fixtures', () => {
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
          }
        })
        .expect(201, {
          id: '6a68271761e4729581283c2b40b7e428c25513cf'
        })

      await request.get('/products').expect(418, products)

      await request
        .delete('/___fixtures/6a68271761e4729581283c2b40b7e428c25513cf')
        .expect(204)

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
            }
          },
          {
            request: {
              path: '/categories',
              method: 'get'
            },
            response: {
              body: categories
            }
          }
        ])
        .expect(201, [
          { id: '6a68271761e4729581283c2b40b7e428c25513cf' },
          { id: '1b8b0bca022acacfd5955c510e06e1ff671a823c' }
        ])

      await Promise.all([
        request.get('/products').expect(200, products),
        request.get('/categories').expect(200, categories)
      ])

      await Promise.all([
        request
          .delete('/___fixtures/6a68271761e4729581283c2b40b7e428c25513cf')
          .expect(204),
        request
          .delete('/___fixtures/1b8b0bca022acacfd5955c510e06e1ff671a823c')
          .expect(204)
      ])

      await Promise.all([
        request.get('/products').expect(404),
        request.get('/categories').expect(404)
      ])
    })

    test.each([
      // Conflicts
      [
        null,
        { method: 'get', path: '/products' },
        { method: 'get', path: '/products' },
        true
      ],
      [
        null,
        { method: 'get', path: '/products', headers: { a: 'a', b: 'b' } },
        { method: 'get', path: '/products', headers: { b: 'b', a: 'a' } },
        true
      ],
      // No conflicts
      [
        null,
        { method: 'get', path: '/products' },
        { method: 'post', path: '/products' },
        false
      ],
      [
        null,
        { method: 'post', path: '/products' },
        { method: 'get', path: '/products' },
        false
      ],
      [
        null,
        { method: 'get', path: '/products' },
        { method: 'get', path: '/categories' },
        false
      ],
      [
        null,
        { method: 'get', path: '/categories' },
        { method: 'get', path: '/products' },
        false
      ]
    ])(
      'conflict situation config="%o" requestA="%o" requestB="%o" shouldConflict=%s',
      async (configuration, requestA, requestB, shouldConflict) => {
        if (configuration) {
          await request
            .put('/___config')
            .send({
              headers: configuration
            })
            .expect(200)
        }

        // Check if combining fixtures in a single request also failed
        const r1 = request.post('/___fixtures/bulk').send(
          [requestA, requestB].map(request => ({
            request: request,
            response: {
              body: {}
            }
          }))
        )

        if (shouldConflict) {
          await r1.expect(409)
        } else {
          await r1.expect(201)
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

        const r2 = request.post('/___fixtures').send({
          request: requestB,
          response: {
            body: {}
          }
        })

        if (shouldConflict) {
          await r2.expect(409)
        } else {
          await r2.expect(201)
        }
      }
    )

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

      await request
        .delete('/___fixtures/d8a1f72e9cd206c612847a7089e8c9460648c4bf')
        .expect(204)

      await request.get('/panda.txt').expect(404)
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
    ])(
      'match headers config="%o" match="%o" request="%o" result=%s',
      async (configuration, matchValues, values, shouldMatch) => {
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
              body: {}
            }
          })
          .expect(201)

        if (shouldMatch && Object.keys(matchValues).length !== 0) {
          await request
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        const r = request
          // eslint-disable-next-line no-unexpected-multiline
          [method](path)
          .set(values)

        if (shouldMatch) {
          await r.expect(200, {})
        } else {
          await r.expect(404)
        }
      }
    )
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
      [
        { xAndY: { x: 'x', y: 'y' } },
        ['xAndY'],
        { x: 'x', y: 'y' },
        null,
        true
      ],
      [
        { xOnly: { x: 'x' }, yOnly: { y: 'y' } },
        ['xOnly', 'yOnly'],
        { x: 'x' },
        null,
        false
      ],
      [
        { xOnly: { x: 'x' }, yOnly: { y: 'y' } },
        ['xOnly', 'yOnly'],
        { x: 'x', y: 'y' },
        null,
        true
      ],
      [
        { xOnly: { x: 'x' } },
        ['xOnly', { y: 'y' }],
        { x: 'x', y: 'y' },
        null,
        true
      ]
    ])(
      'match cookies config="%o" match="%s %o" request="%s %o" result=%s',
      async (configuration, matchValues, values, options, shouldMatch) => {
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
              body: {}
            }
          })
          .expect(201)

        if (shouldMatch && Object.keys(matchValues).length !== 0) {
          await request
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        const cookies = Object.entries(values)
          .reduce((acc, [key, value]) => {
            acc.push(`${key}=${value}`)
            return acc
          }, [])
          .join(';')

        const r = request[method](path)

        if (cookies) {
          r.set('Cookie', [cookies])
        }

        if (shouldMatch) {
          await r.expect(200, {})
        } else {
          await r.expect(404)
        }
      }
    )
  })

  describe('matching query', () => {
    test.each([
      [null, '/test', { x: '1' }, '/test', null, false],
      [null, '/test', { x: '1' }, '/test', { strict: true }, false],
      [null, '/test', { x: '1' }, '/test?x=1', null, true],
      [null, '/test', { x: '1' }, '/test?x=1', { strict: true }, true],
      [null, '/test', { x: '1' }, '/test?x=2', null, false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1', null, false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1', y: '2' }, '/test?y=2&x=1', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', null, true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', { strict: true }, false],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', null, true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=2', null, false],
      [
        { xAndY: { x: '1', y: '2' } },
        '/test',
        ['xAndY'],
        '/test?x=1&y=2',
        null,
        true
      ],
      [
        { xOnly: { x: '1' }, yOnly: { y: '2' } },
        '/test',
        ['xOnly', 'yOnly'],
        '/test?x=1&y=2',
        null,
        true
      ],
      [
        { xOnly: { x: '1' } },
        '/test',
        ['xOnly', { y: '2' }],
        '/test?x=1&y=2',
        null,
        true
      ]
    ])(
      'match query config="%o" match="%s %o" request="%s %o" result=%s',
      async (
        configuration,
        matchPath,
        matchValues,
        path,
        options,
        shouldMatch
      ) => {
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

        const r = request[method](path)

        if (shouldMatch) {
          await r.expect(200, {})
        } else {
          await r.expect(404)
        }
      }
    )
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
      [null, { x: 'x', other: 'other' }, { x: 'x' }, false]
    ])(
      'match body config="%o" match="%s" request="%o" result=%s',
      async (configuration, matchValues, values, shouldMatch) => {
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

        if (shouldMatch && Object.keys(matchValues).length !== 0) {
          await request
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        const r = request
          // eslint-disable-next-line no-unexpected-multiline
          [method](path)
          .send(values)

        if (shouldMatch) {
          await r.expect(200, {})
        } else {
          await r.expect(404)
        }
      }
    )
  })

  describe('analyze response', () => {
    test('delay response', async () => {
      await request
        .post('/___fixtures')
        .send({
          request: {
            path: '/products',
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
})
