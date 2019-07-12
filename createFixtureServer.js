const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

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

// function isRouteAlreadyRegistered(app, routeName) {
//   return app._router.stack.some(({ route }) => !!route && route.stack.some(({ handle }) => handle.name === routeName))
// }

function generateRouteId (path, method) {
  return `_${Buffer.from(`${path},${method}`).toString('hex')}`
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

// function conflict(res, message) {
//   return error(res, 409, message)
// }

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
    const { request, response } = fixtureReq.body
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
    const routeName = generateRouteId(path, method)

    // TODO: should we handle a conflict for route ?
    // It can't work with parameterized url like /path/:id
    // if (isRouteAlreadyRegistered(app, routeName)) {
    //   return conflict(fixtureRes, `Route ${method.toUpperCase()} ${path} is already registered.`)
    // }

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
      }, routeName)
    )

    fixtureRes.status(201).send({
      id: routeName
    })
  })

  app.delete('/___fixtures/:id', (req, res) => {
    removeRoute(app, req.params.id)
    res.status(204).send({})
  })

  app.delete('/___fixtures', (req, res) => {
    const { path, method } = req.body

    if (typeof path !== 'string' || typeof method !== 'string') {
      return badRequest(res, 'path or method are not provided')
    }

    removeRoute(app, generateRouteId(path, method))
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
