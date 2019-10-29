describe('app.js', () => {
  const request = require('supertest')

  describe('manipulate configuration', () => {
    const server = require('../createFixtureServer')()

    test('default configuration', () =>
      request(server)
        .get('/___config')
        .expect(200, {
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

      await request(server)
        .put('/___config')
        .send(config)
        .expect(200)

      return request(server)
        .get('/___config')
        .expect(200, {
          ...config,
          params: {},
          query: {},
          cookies: {}
        })
    })
  })

  describe('create and remove simple fixture', () => {
    const server = require('../createFixtureServer')()

    test('create simple fixture', async () => {
      const products = [{ id: 1 }, { id: 2 }]

      await request(server)
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
          id: 'f0e63e05abb428d1c09fdc89bf55247abb6760a8'
        })

      await request(server)
        .get('/products')
        .expect(200, products)
    })

    test('remove fixture with id', async () => {
      await request(server)
        .post('/___fixtures')
        .send({
          request: {
            route: {
              path: '/products',
              method: 'get'
            }
          },
          response: {
            body: []
          }
        })
        .expect(201, {
          id: '7471423e00c234a5f03064969debd4f5512ed1ab'
        })

      await request(server)
        .delete('/___fixtures/7471423e00c234a5f03064969debd4f5512ed1ab')
        .expect(204, {})
    })

    test('remove all fixtures', async () => {
      await request(server)
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
          id: '45b1b26011e768948244373e164cac946749f6f4'
        })

      await request(server)
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
          id: '8b4ed050873ad1cc900b7b04747dadd907af8236'
        })

      await request(server)
        .delete('/___fixtures')
        .expect(204, {})

      await request(server)
        .get('/octopus')
        .expect(404, {})

      await request(server)
        .get('/___fixtures/45b1b26011e768948244373e164cac946749f6f4')
        .expect(404, {})

      await request(server)
        .get('/giraffes')
        .expect(404, {})

      await request(server)
        .get('/___fixtures/8b4ed050873ad1cc900b7b04747dadd907af8236')
        .expect(404, {})
    })
  })

  describe('multiple fixtures', () => {
    const server = require('../createFixtureServer')()

    test('add fixtures', async () => {
      await request(server)
        .post('/___fixtures')
        .send([
          {
            request: {
              route: {
                path: '/products',
                method: 'get'
              }
            },
            response: {
              body: []
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
              body: []
            }
          }
        ])
        .expect(201, [
          { id: '7471423e00c234a5f03064969debd4f5512ed1ab' },
          { id: '8b9d2c90e10d88caf01df509e4306a6db10e5264' }
        ])
    })

    test('remove fixtures', async () => {
      await request(server)
        .delete('/___fixtures/f0e63e05abb428d1c09fdc89bf55247abb6760a8')
        .expect(204, {})

      await request(server)
        .delete('/___fixtures/8b9d2c90e10d88caf01df509e4306a6db10e5264')
        .expect(204, {})
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
        const server = require('../createFixtureServer')()
        const path = '/test'
        const method = 'get'

        if (configuration) {
          await request(server)
            .put('/___config')
            .send({
              headers: configuration
            })
            .expect(200)
        }

        await request(server)
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
          await request(server)
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        const r = request(server)
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
        const server = require('../createFixtureServer')()
        const path = '/test'
        const method = 'get'

        if (configuration) {
          await request(server)
            .put('/___config')
            .send({
              cookies: configuration
            })
            .expect(200)
        }

        await request(server)
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
          await request(server)
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

        const r = request(server)[method](path)

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
        const server = require('../createFixtureServer')()
        const method = 'get'

        if (configuration) {
          await request(server)
            .put('/___config')
            .send({
              params: configuration
            })
            .expect(200)
        }

        if (shouldMatch && Object.keys(matchValues).length !== 0) {
          await request(server)
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        await request(server)
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

        const r = request(server)[method](path)

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
        const server = require('../createFixtureServer')()
        const method = 'get'

        if (configuration) {
          await request(server)
            .put('/___config')
            .send({
              query: configuration
            })
            .expect(200)
        }

        await request(server)
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

        const r = request(server)[method](path)

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
        const server = require('../createFixtureServer')()
        const path = '/test'
        const method = 'get'

        if (configuration) {
          await request(server)
            .put('/___config')
            .send({
              body: configuration
            })
            .expect(200)
        }

        await request(server)
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
          await request(server)
            // eslint-disable-next-line no-unexpected-multiline
            [method](path)
            .expect(404)
        }

        const r = request(server)
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
