const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')
const {
  doesPropertyMatch,
  resolveProperty,
  useResponseProperties
} = require('./properties')

function setFnName (fn, name) {
  Object.defineProperty(fn, 'name', { value: name, configurable: true })

  return fn
}

function removeRoute (app, routeName) {
  let removed = false

  app._router.stack.forEach(({ route }) => {
    if (!route) {
      return
    }

    const routeIndex = route.stack.findIndex(
      ({ handle }) => handle.name === routeName
    )

    if (routeIndex >= 0) {
      route.stack.splice(routeIndex, 1)
      removed = true
    }
  })

  return removed
}

function removeRoutes (app) {
  app._router.stack.forEach(({ route }) => {
    if (!route) {
      return
    }

    route.stack = []
  })
}

function isRouteAlreadyRegistered (app, routeName) {
  const _routeName = '_' + routeName

  return app._router.stack.some(({ name, route }) => {
    if (name === _routeName) {
      return true
    }

    if (route && route.stack.some(({ name }) => name === _routeName)) {
      return true
    }

    return false
  })
}

function sortObjectKeys (obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, curr) => {
      acc[curr] = obj[curr]
      return acc
    }, {})
}

function createFixtureId (fixture) {
  const safeFixtureData = JSON.stringify({
    request: sortObjectKeys(fixture.request),
    response: sortObjectKeys(fixture.response)
  })

  return crypto
    .createHash('sha1')
    .update(safeFixtureData)
    .digest('hex')
}

function error (res, status, message) {
  return res
    .status(status)
    .send({ message: `[FIXTURE SERVER ERROR ${status}]: ${message}` })
}

function badRequest (res, message) {
  return error(res, 400, message)
}

function notFound (res, message) {
  return error(res, 404, message)
}

function conflict (res, message) {
  return error(res, 409, message)
}

const REQUEST_PROPERTIES = ['headers', 'params', 'body', 'query', 'cookies']
const RESPONSE_PROPERTIES = ['headers', 'body', 'cookies']

let configuration = {
  routes: {},
  filePaths: {},
  headers: {},
  params: {},
  query: {},
  cookies: {}
}

function createFixtureServer () {
  const app = express()
  app.use(bodyParser.json())
  app.use(cookieParser())

  app.post('/___fixtures', (fixtureReq, fixtureRes) => {
    const fixtures = [].concat(fixtureReq.body)
    const routeIds = []

    for (const fixture of fixtures) {
      const { request, response } = fixture
      const route = configuration[request.route] || request.route

      if (
        typeof route !== 'object' ||
        typeof route.path !== 'string' ||
        typeof route.method !== 'string'
      ) {
        return badRequest(fixtureRes, 'path or method are not provided')
      }

      for (const property of REQUEST_PROPERTIES) {
        const { error, values } = resolveProperty(
          configuration,
          request[property],
          property
        )

        if (error) {
          return badRequest(fixtureRes, error)
        }

        request[property] = values
      }

      const { path, method } = route
      const routeId = createFixtureId(fixture)

      if (isRouteAlreadyRegistered(app, routeId)) {
        return conflict(
          fixtureRes,
          `Route ${method.toUpperCase()} ${path} is already registered.`
        )
      }

      app[method](
        path,
        setFnName((req, res) => {
          for (const property of REQUEST_PROPERTIES) {
            if (!doesPropertyMatch(req, request, property)) {
              return notFound(res, 'Not mocked')
            }
          }

          for (const property of RESPONSE_PROPERTIES) {
            const { error, values } = resolveProperty(
              configuration,
              response[property],
              property
            )

            if (error) {
              return badRequest(fixtureRes, error)
            }

            useResponseProperties[property](res, values)
          }

          res.status(response.status || 200)
        }, '_' + routeId)
      )

      routeIds.push(routeId)
    }

    const result =
      routeIds.length > 1 ? routeIds.map(id => ({ id })) : { id: routeIds[0] }

    fixtureRes.status(201).send(result)
  })

  app.delete('/___fixtures', (req, res) => {
    removeRoutes(app)
    res.status(204).send({})
  })

  app.delete('/___fixtures/:id', (req, res) => {
    removeRoute(app, '_' + req.params.id)
    res.status(204).send({})
  })

  app.get('/___config', (req, res) => {
    res.status(200).send(configuration)
  })

  app.put('/___config', (req, res) => {
    const {
      routes = {},
      filePaths = {},
      headers = {},
      params = {},
      query = {},
      cookies = {}
    } = req.body

    if (
      typeof routes !== 'object' ||
      typeof filePaths !== 'object' ||
      typeof headers !== 'object' ||
      typeof params !== 'object' ||
      typeof query !== 'object' ||
      typeof cookies !== 'object'
    ) {
      return badRequest(res, '')
    }

    configuration = {
      routes,
      filePaths,
      headers,
      params,
      query,
      cookies
    }

    res.status(200).send(configuration)
  })

  return app
}

module.exports = createFixtureServer
