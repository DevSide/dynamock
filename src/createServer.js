const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const {
  REQUEST_PROPERTIES,
  RESPONSE_PROPERTIES,
  doesPropertyMatch,
  useResponseProperties
} = require('./properties')
const {
  validateFixture,
  removeFixture,
  removeFixtures,
  registerFixture,
  getFixtureIterator
} = require('./fixtures')
const {
  validateConfiguration,
  createConfiguration,
  updateConfiguration
} = require('./configuration')

function resError (res, status, message) {
  return res
    .status(status)
    .send({ message: `[FIXTURE SERVER ERROR ${status}]: ${message}` })
}

function badRequest (res, message) {
  return resError(res, 400, message)
}

function conflict (res, message) {
  return resError(res, 409, message)
}

function createServer () {
  const app = express()
  const server = require('http').createServer(app)

  app.use(bodyParser.json())
  app.use(cookieParser())

  let configuration = createConfiguration()

  app.post('/___fixtures', (req, res) => {
    const unsafeFixture = req.body

    const validationError = validateFixture(unsafeFixture, configuration)

    if (validationError) {
      return badRequest(res, validationError)
    }

    const { conflictError, fixtureId } = registerFixture(
      unsafeFixture,
      configuration
    )

    if (conflictError) {
      return conflict(res, conflictError)
    }

    res.status(201).send({ id: fixtureId })
  })

  app.post('/___fixtures/bulk', (req, res) => {
    const fixtures = req.body
    const fixtureIds = []

    const cleanUpOnError = () => {
      for (const { id } of fixtureIds) {
        removeFixture(id)
      }
    }

    for (const unsafeFixture of fixtures) {
      const validationError = validateFixture(unsafeFixture, configuration)

      if (validationError) {
        cleanUpOnError()

        return badRequest(res, validationError)
      }

      const { conflictError, fixtureId } = registerFixture(
        unsafeFixture,
        configuration
      )

      if (conflictError) {
        cleanUpOnError()

        return conflict(res, conflictError)
      }

      fixtureIds.push({ id: fixtureId })
    }

    res.status(201).send(fixtureIds)
  })

  app.delete('/___fixtures', (req, res) => {
    removeFixtures()
    res.status(204).send({})
  })

  app.delete('/___fixtures/:id', (req, res) => {
    if (removeFixture(req.params.id)) {
      res.status(204).send({})
    } else {
      resError(res, 404, 'Fixture not found.')
    }
  })

  app.get('/___config', (req, res) => {
    res.status(200).send(configuration)
  })

  app.put('/___config', (req, res) => {
    const error = validateConfiguration(req.body)

    if (error) {
      return badRequest(res, error.message)
    }

    const { headers, query, cookies } = req.body
    updateConfiguration(configuration, headers, query, cookies)

    res.status(200).send(configuration)
  })

  app.delete('/___config', (req, res) => {
    configuration = createConfiguration()
    res.status(204).send()
  })

  app.use(function fixtureHandler (req, res, next) {
    // eslint-disable-next-line no-labels
    fixtureLoop: for (const [, fixture] of getFixtureIterator()) {
      const { request, response } = fixture

      if (
        (req.path !== request.path && request.path !== '*') ||
        (req.method !== request.method && request.method !== '*')
      ) {
        continue
      }

      for (const property of REQUEST_PROPERTIES) {
        if (!doesPropertyMatch(req, request, property)) {
          // eslint-disable-next-line no-labels
          continue fixtureLoop
        }
      }

      const send = () => {
        res.status(response.status || 200)

        // Loop over RESPONSE_PROPERTIES which has the right order
        // avoiding "Can't set headers after they are sent"
        for (const property of RESPONSE_PROPERTIES) {
          if (response[property] !== undefined) {
            useResponseProperties[property](req, res, response[property])
          }
        }
      }

      if (response.options && response.options.delay) {
        setTimeout(send, response.options.delay)
      } else {
        send()
      }

      return
    }

    next()
  })

  server.on('close', () => {
    removeFixtures()
  })

  return server
}

module.exports = createServer
