const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')

// function isObjectEmpty (obj) {
//   for (const key in obj) {
//     if (Object.hasOwnProperty.call(obj, key)) {
//       return false
//     }
//   }
//
//   return true
// }

function doesPropertyMatch (request, match, property) {
  const requestProperty = request[property] || {}
  const matchProperty = match[property] || {}

  return Object.keys(matchProperty).every(
    key =>
      String(matchProperty[key]).toLowerCase() ===
      String(requestProperty[key]).toLowerCase()
  )
}

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

  // console.log('######## isRouteAlreadyRegistered', _routeName)
  //
  // app._router.stack.forEach(({ name, route }) => {
  //   console.log('######## name', name)
  //
  //   if (route) {
  //     route.stack.forEach(({ name }) => {
  //       console.log('######## route.name', name)
  //     })
  //   }
  //
  // })

  return app._router.stack.some(({ name, handle, route }) => {
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

function resolveProperty (res, configuration, matchProperties, property) {
  const values = {}

  if (matchProperties) {
    if (property === 'body') {
      return matchProperties
    }

    if (Array.isArray(matchProperties)) {
      for (const matchProperty of matchProperties) {
        if (typeof matchProperty === 'string') {
          const fromConfig = configuration[property][matchProperty]

          if (!fromConfig) {
            badRequest(
              res,
              `${property} group named ${matchProperty} is not in the configuration`
            )
            return null
          }

          Object.assign(values, fromConfig)
        } else if (
          !Array.isArray(matchProperty) &&
          typeof matchProperty === 'object'
        ) {
          Object.assign(values, matchProperty)
        } else {
          badRequest(
            res,
            `${property} "${matchProperty}" should be an object or a configuration header group name.`
          )
          return null
        }
      }
    } else if (typeof matchProperties === 'object') {
      Object.assign(values, matchProperties)
    } else {
      badRequest(res, `${property} should be an array or an object.`)
      return null
    }
  }

  return values
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

const useResponseProperties = {
  filePaths: () => {
    throw new Error('not implemented')
  },
  headers: (res, value) => res.set(value),
  body: (res, value) => res.send(value),
  cookies: (res, value) =>
    Object.entries(value).forEach((r, pair) => {
      res.cookie(...pair)
    })
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
        request[property] = resolveProperty(
          fixtureRes,
          configuration,
          request[property],
          property
        )

        // error
        if (!request[property]) {
          return
        }
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
            const values = resolveProperty(
              res,
              configuration,
              response[property],
              property
            )

            // error
            if (!values) {
              return
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
