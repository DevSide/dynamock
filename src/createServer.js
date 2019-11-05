const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const querystring = require('querystring')
const {
  REQUEST_PROPERTIES,
  RESPONSE_PROPERTIES,
  doesPropertyMatch,
  resolveProperty,
  useResponseProperties
} = require('./properties')
const { removeRoute, removeRoutes, getRouteId } = require('./routeManager')
const { setFnName } = require('./utils')
const _isEmpty = require('lodash/isEmpty')

function error (res, status, message) {
  return res
    .status(status)
    .send({ message: `[FIXTURE SERVER ERROR ${status}]: ${message}` })
}

function badRequest (res, message) {
  return error(res, 400, message)
}

function conflict (res, message) {
  return error(res, 409, message)
}

function createConfiguration () {
  return {
    paths: {},
    methods: {},
    headers: {},
    params: {},
    query: {},
    cookies: {}
  }
}

function handleFixtureRoute (
  app,
  configuration,
  fixtureRes,
  fixture,
  checkConflict = () => ''
) {
  const { request, response } = fixture
  let path = configuration.paths[request.path] || request.path
  const method = configuration.methods[request.method] || request.method

  if (typeof path !== 'string' || typeof method !== 'string') {
    return {
      createError: () =>
        badRequest(fixtureRes, 'Path or method are not provided')
    }
  }

  // Extract query string from path and merge params
  const indexQueryString = path.indexOf('?')
  if (indexQueryString >= 0) {
    path = path.substring(0, indexQueryString)
    request.query = {
      ...(request.query || {}),
      ...querystring.parse(path.substring(indexQueryString + 1))
    }
  }

  for (const property of REQUEST_PROPERTIES) {
    const { error, values } = resolveProperty(
      configuration,
      request[property],
      property
    )

    if (error) {
      return {
        createError: () => badRequest(fixtureRes, error)
      }
    }

    request[property] = values
  }

  const { error, routeId } = getRouteId(app, fixture)

  if (error) {
    return {
      createError: () =>
        conflict(
          fixtureRes,
          `Route ${method.toUpperCase()} ${path} is already registered`
        )
    }
  }

  const customError = checkConflict(routeId)

  if (customError) {
    return {
      createError: () => conflict(fixtureRes, customError)
    }
  }

  // Lazy create routes: we don't register any routes before all fixtures get validated
  return {
    routeId,
    createRoute: () =>
      app[method.toLowerCase()](
        path,
        setFnName((req, res, next) => {
          for (const property of REQUEST_PROPERTIES) {
            if (!doesPropertyMatch(req, request, property)) {
              return next()
            }
          }

          res.status(response.status || 200)

          for (const property of RESPONSE_PROPERTIES) {
            // Body is ignored if filepath is set and vice versa
            if (
              (response.filepath && property === 'body') ||
              (response.body && property === 'filepath')
            ) {
              continue
            }

            const { error, values } = resolveProperty(
              configuration,
              response[property],
              property
            )

            if (error) {
              return badRequest(fixtureRes, error)
            }

            if (!_isEmpty(values) || property === 'body') {
              // TODO: use configuration for the response
              useResponseProperties[property](req, res, values)
            }
          }

          // Ensure we have a response
          if (!response.filepath && response.body === undefined) {
            res.send('')
          }
        }, routeId)
      )
  }
}

function createServer () {
  const app = express()
  const server = require('http').createServer(app)

  app.use(bodyParser.json())
  app.use(cookieParser())

  let configuration = createConfiguration()

  app.post('/___fixtures', (fixtureReq, fixtureRes) => {
    const fixture = fixtureReq.body

    const { createError, routeId, createRoute } = handleFixtureRoute(
      app,
      configuration,
      fixtureRes,
      fixture
    )

    if (createError) {
      return createError()
    }

    createRoute()

    fixtureRes.status(201).send({ id: routeId })
  })

  app.post('/___fixtures/bulk', (fixtureReq, fixtureRes) => {
    const fixtures = fixtureReq.body
    const routeIds = []
    const createRoutes = []

    for (const fixture of fixtures) {
      const { createError, routeId, createRoute } = handleFixtureRoute(
        app,
        configuration,
        fixtureRes,
        fixture,
        routeId => routeIds.some(id => id === routeId)
      )

      if (createError) {
        return createError()
      }

      createRoutes.push(createRoute)
      routeIds.push(routeId)
    }

    for (const createRoute of createRoutes) {
      createRoute()
    }

    fixtureRes.status(201).send(routeIds.map(id => ({ id })))
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
      paths = {},
      methods = {},
      headers = {},
      params = {},
      query = {},
      cookies = {}
    } = req.body

    if (
      typeof paths !== 'object' ||
      typeof methods !== 'object' ||
      typeof headers !== 'object' ||
      typeof params !== 'object' ||
      typeof query !== 'object' ||
      typeof cookies !== 'object'
    ) {
      return badRequest(res, 'Wrong configuration format')
    }

    configuration = {
      paths,
      methods,
      headers,
      params,
      query,
      cookies
    }

    res.status(200).send(configuration)
  })

  app.delete('/___config', (req, res) => {
    configuration = createConfiguration()
    res.status(204).send()
  })

  server.on('close', () => {
    removeRoutes(app)
  })

  return server
}

module.exports = createServer
