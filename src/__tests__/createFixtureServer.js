describe('app.js', () => {
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

    app = require('../createFixtureServer')()
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
        routes: {},
        filePaths: {},
        headers: {},
        params: {},
        query: {},
        cookies: {}
      }))

    test('update configuration', async () => {
      const config = {
        routes: {
          getProducts: {
            path: '/products',
            method: 'get,'
          },
          postCategory: {
            path: '/categories',
            method: 'post,'
          }
        },
        filePaths: {
          assets: './assets'
        },
        headers: {
          serverCors: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*'
          },
          clientToken: {
            authorization: 'Bearer client-token'
          }
        }
      }

      await request
        .put('/___config')
        .send(config)
        .expect(200)

      return request.get('/___config').expect(200, {
        ...config,
        params: {},
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
            route: {
              path: '/products',
              method: 'get'
            }
          },
          response: {
            body: products
          }
        })
        .expect(201, {
          id: '_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508'
        })

      await request.get('/products').expect(200, products)

      await request
        .delete('/___fixtures/_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508')
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
              route: {
                path: '/products',
                method: 'get'
              }
            },
            response: {
              body: products
            }
          },
          {
            request: {
              route: {
                path: '/categories',
                method: 'get'
              }
            },
            response: {
              body: categories
            }
          }
        ])
        .expect(201, [
          { id: '_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508' },
          { id: '_086c67ef89fd832deeae33b209e6e8ecc6b32003' }
        ])

      await Promise.all([
        request.get('/products').expect(200, products),
        request.get('/categories').expect(200, categories)
      ])

      await Promise.all([
        request
          .delete('/___fixtures/_38ed32e9fb0a1e5c7cb1b6f0ff43f6060d8b4508')
          .expect(204),
        request
          .delete('/___fixtures/_086c67ef89fd832deeae33b209e6e8ecc6b32003')
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
        { route: { method: 'get', path: '/products' } },
        { route: { method: 'get', path: '/products' } },
        true
      ],
      [
        null,
        { route: { method: 'get', path: '/products' }, headers: {} },
        { route: { method: 'get', path: '/products' }, headers: {} },
        true
      ],
      [
        null,
        { route: { method: 'get', path: '/products' }, headers: {} },
        { route: { method: 'get', path: '/products' } },
        true
      ],
      [
        null,
        { route: { method: 'get', path: '/products' }, headers: null },
        { route: { method: 'get', path: '/products' }, headers: {} },
        true
      ],
      [
        null,
        {
          route: { method: 'get', path: '/products' },
          headers: { a: 'a', b: 'b' }
        },
        {
          route: { method: 'get', path: '/products' },
          headers: { b: 'b', a: 'a' }
        },
        true
      ],
      // No conflicts
      [
        null,
        { route: { method: 'get', path: '/products' } },
        { route: { method: 'post', path: '/products' } },
        false
      ],
      [
        null,
        { route: { method: 'post', path: '/products' } },
        { route: { method: 'get', path: '/products' } },
        false
      ],
      [
        null,
        { route: { method: 'get', path: '/products' } },
        { route: { method: 'get', path: '/categories' } },
        false
      ],
      [
        null,
        { route: { method: 'get', path: '/categories' } },
        { route: { method: 'get', path: '/products' } },
        false
      ]
    ])(
      'conflict situation config="%o" requestA="%s %o" requestB="%s %o" shouldConflict=%s',
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
            route: {
              path: '/octopus',
              method: 'get'
            }
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: '_cd2cafef7bda972b054401001629b44e5153071a'
        })

      await request
        .post('/___fixtures')
        .send({
          request: {
            route: {
              path: '/giraffes',
              method: 'get'
            }
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: '_d10055677f253af6fa9f1a0279e506ae8af025df'
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
            route: {
              path: '/panda.txt',
              method: 'get'
            }
          },
          response: {
            filepath: file
          }
        })
        .expect(201, {
          id: '_38aba9e8e2f898a144f94d85b9de33098cd3836d'
        })

      await request
        .get('/panda.txt')
        .expect('Content-Type', /text\/plain/)
        .expect(200, 'pandas !')

      await request
        .delete('/___fixtures/_38aba9e8e2f898a144f94d85b9de33098cd3836d')
        .expect(204)

      await request.get('/panda.txt').expect(404)
    })
  })

  describe('matching headers', () => {
    test.each([
      [null, {}, {}, true],
      [null, [], {}, true],
      [null, {}, [], true],
      [null, [], [], true],
      [null, {}, { x: 'y' }, true],
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
      'match headers config="%o" match="%s %o" request="%s %o" result=%s',
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
              route: {
                path,
                method
              },
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
      [null, {}, {}, true],
      [null, [], {}, true],
      [null, {}, [], true],
      [null, [], [], true],
      [null, {}, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, true],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], {}, false],
      [{ xOnly: { x: 'x' } }, ['xOnly'], { x: 'x' }, true],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x' }, false],
      [{ xAndY: { x: 'x', y: 'y' } }, ['xAndY'], { x: 'x', y: 'y' }, true],
      [
        { xOnly: { x: 'x' }, yOnly: { y: 'y' } },
        ['xOnly', 'yOnly'],
        { x: 'x' },
        false
      ],
      [
        { xOnly: { x: 'x' }, yOnly: { y: 'y' } },
        ['xOnly', 'yOnly'],
        { x: 'x', y: 'y' },
        true
      ]
    ])(
      'match cookies config="%o" match="%s %o" request="%s %o" result=%s',
      async (configuration, matchValues, values, shouldMatch) => {
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
              route: {
                path,
                method
              },
              cookies: matchValues
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

  describe('matching params', () => {
    test.each([
      [null, '/test/:x', { x: 1 }, '/test/1', true],
      [null, '/test/:x', { x: 1 }, '/test/2', false],
      [null, '/test/:x/:y', { x: 1 }, '/test/1', false],
      [null, '/test/:x/:y', { x: 1 }, '/test/1/2', true],
      [null, '/test/:x/:y', { x: 1, y: 2 }, '/test/1/2', true],
      [{ xOnly: { x: 1 } }, '/test/:x', ['xOnly'], '/test/1', true],
      [{ xAndY: { x: 1, y: 2 } }, '/test/:x/:y', ['xAndY'], '/test/1/2', true],
      [
        { xOnly: { x: 1 }, yOnly: { y: 2 } },
        '/test/:x/:y',
        ['xOnly', 'yOnly'],
        '/test/1/2',
        true
      ]
    ])(
      'match params config="%o" match="%s %o" request="%s %o" result=%s',
      async (configuration, matchPath, matchValues, path, shouldMatch) => {
        const method = 'get'

        if (configuration) {
          await request
            .put('/___config')
            .send({
              params: configuration
            })
            .expect(200)
        }

        if (shouldMatch && Object.keys(matchValues).length !== 0) {
          await request
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        await request
          .post('/___fixtures')
          .send({
            request: {
              route: {
                path: matchPath,
                method
              },
              params: matchValues
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

  describe('matching query', () => {
    test.each([
      [null, '/test', { x: 1 }, '/test', false],
      [null, '/test', { x: 1 }, '/test?x=1', true],
      [null, '/test', { x: 1 }, '/test?x=2', false],
      [null, '/test', { x: 1, y: 2 }, '/test?x=1', false],
      [null, '/test', { x: 1, y: 2 }, '/test?x=1&y=2', true],
      [null, '/test', { x: 1 }, '/test?x=1&y=2', true],
      [{ xOnly: { x: 1 } }, '/test', ['xOnly'], '/test?x=1', true],
      [{ xOnly: { x: 1 } }, '/test', ['xOnly'], '/test?x=2', false],
      [{ xAndY: { x: 1, y: 2 } }, '/test', ['xAndY'], '/test?x=1&y=2', true],
      [
        { xOnly: { x: 1 }, yOnly: { y: 2 } },
        '/test',
        ['xOnly', 'yOnly'],
        '/test?x=1&y=2',
        true
      ]
    ])(
      'match query config="%o" match="%s %o" request="%s %o" result=%s',
      async (configuration, matchPath, matchValues, path, shouldMatch) => {
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
              route: {
                path: matchPath,
                method
              },
              query: matchValues
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
      [null, {}, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x' }, true],
      [null, { x: 'x' }, { x: 'x', other: 'other' }, true],
      [null, { x: 'x', other: 'other' }, { x: 'x' }, false]
    ])(
      'match body config="%o" match="%s %o" request="%s %o" result=%s',
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
              route: {
                path,
                method
              },
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
})
