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
        params: {},
        query: {},
        cookies: {}
      }))

    test('update configuration', async () => {
      const config = {
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
            path: '/products',
            method: 'get'
          },
          response: {
            body: products
          }
        })
        .expect(201, {
          id: '_33c6576937436b740a2de39e87c35ba939f8e632'
        })

      await request.get('/products').expect(200, products)

      await request
        .delete('/___fixtures/_33c6576937436b740a2de39e87c35ba939f8e632')
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
          { id: '_33c6576937436b740a2de39e87c35ba939f8e632' },
          { id: '_524f2126883bf307c73ebda847f4b41cd3598bad' }
        ])

      await Promise.all([
        request.get('/products').expect(200, products),
        request.get('/categories').expect(200, categories)
      ])

      await Promise.all([
        request
          .delete('/___fixtures/_33c6576937436b740a2de39e87c35ba939f8e632')
          .expect(204),
        request
          .delete('/___fixtures/_524f2126883bf307c73ebda847f4b41cd3598bad')
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
        { method: 'get', path: '/products', headers: {} },
        { method: 'get', path: '/products', headers: {} },
        true
      ],
      [
        null,
        { method: 'get', path: '/products', headers: {} },
        { method: 'get', path: '/products' },
        true
      ],
      [
        null,
        { method: 'get', path: '/products', headers: null },
        { method: 'get', path: '/products', headers: {} },
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
            path: '/octopus',
            method: 'get'
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: '_28108d4eb932b6072942a215b90a7b2f8ed58f20'
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
          id: '_c15ade1e13fd610b74885d4135803bc2245f3410'
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
          id: '_84ae3159c8de155bc45c268642c8c050ba00b061'
        })

      await request
        .get('/panda.txt')
        .expect('Content-Type', /text\/plain/)
        .expect(200, 'pandas !')

      await request
        .delete('/___fixtures/_84ae3159c8de155bc45c268642c8c050ba00b061')
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
              path,
              method,
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
      [null, '/test/:x', { x: '1' }, '/test/1', true],
      [null, '/test/:x', { x: '1' }, '/test/2', false],
      [null, '/test/:x/:y', { x: '1' }, '/test/1', false],
      [null, '/test/:x/:y', { x: '1' }, '/test/1/2', true],
      [null, '/test/:x/:y', { x: '1', y: '2' }, '/test/1/2', true],
      [{ xOnly: { x: '1' } }, '/test/:x', ['xOnly'], '/test/1', true],
      [
        { xAndY: { x: '1', y: '2' } },
        '/test/:x/:y',
        ['xAndY'],
        '/test/1/2',
        true
      ],
      [
        { xOnly: { x: '1' }, yOnly: { y: '2' } },
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
              path: matchPath,
              method,
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
      [null, '/test', { x: '1' }, '/test', false],
      [null, '/test', { x: '1' }, '/test?x=1', true],
      [null, '/test', { x: '1' }, '/test?x=2', false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1', false],
      [null, '/test', { x: '1', y: '2' }, '/test?x=1&y=2', true],
      [null, '/test', { x: '1' }, '/test?x=1&y=2', true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=1', true],
      [{ xOnly: { x: '1' } }, '/test', ['xOnly'], '/test?x=2', false],
      [
        { xAndY: { x: '1', y: '2' } },
        '/test',
        ['xAndY'],
        '/test?x=1&y=2',
        true
      ],
      [
        { xOnly: { x: '1' }, yOnly: { y: '2' } },
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
              path: matchPath,
              method,
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
})
