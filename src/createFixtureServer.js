const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const {
  doesPropertyMatch,
  resolveProperty,
  useResponseProperties
} = require('./properties')
const { removeRoute, removeRoutes, getRouteId } = require('./routeManager')
const { setFnName } = require('./utils')

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
  const server = require('http').createServer(app)

  app.use(bodyParser.json())
  app.use(cookieParser())

  app.post('/___fixtures', (fixtureReq, fixtureRes) => {
    const fixtures = [].concat(fixtureReq.body)
    const routeIds = []
    const createRoutes = []

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
      const { error, routeId } = getRouteId(app, route)

      if (error || routeIds.some(id => id === routeId)) {
        return conflict(
          fixtureRes,
          `Route ${method.toUpperCase()} ${path} is already registered.`
        )
      }

      // Lazy create routes: we don't register any routes before all fixtures get validated
      createRoutes.push(() =>
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
          }, routeId)
        )
      )

      routeIds.push(routeId)
    }

    for (const createRoute of createRoutes) {
      createRoute()
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
    removeRoute(app, req.params.id)
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

  server.on('close', () => {
    removeRoutes(app)
  })

  return server
}

module.exports = createFixtureServer
