import express from 'express'
import cookieParser from 'cookie-parser'
import { REQUEST_PROPERTIES, requestPropertyMatch, RESPONSE_PROPERTIES, useResponseProperties } from './properties.js'
import { getFixtureIterator, registerFixture, removeFixture, removeFixtures, validateFixture } from './fixtures.js'
import { createConfiguration, updateConfiguration, validateConfiguration } from './configuration.js'
import { createServer as createHTTPServer } from 'node:http'

function resError(res, status, message) {
  return res.status(status).send({ message: `[FIXTURE SERVER ERROR ${status}]: ${message}` })
}

function badRequest(res, message) {
  return resError(res, 400, message)
}

function conflict(res, message) {
  return resError(res, 409, message)
}

export function createServer() {
  const app = express()
  const server = createHTTPServer(app)
  const corsAllowAllHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
  }

  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())
  app.disable('x-powered-by')
  app.disable('etag')

  let configuration = createConfiguration()

  app.post('/___fixtures', (req, res) => {
    const unsafeFixture = req.body

    const validationError = validateFixture(unsafeFixture, configuration)

    if (validationError) {
      return badRequest(res, validationError)
    }

    const { conflictError, fixtureId } = registerFixture(unsafeFixture, configuration)

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

      const { conflictError, fixtureId } = registerFixture(unsafeFixture, configuration)

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
    removeFixture(req.params.id)
    res.status(204).send()
  })

  app.get('/___config', (req, res) => {
    res.status(200).send(configuration)
  })

  app.put('/___config', (req, res) => {
    const error = validateConfiguration(req.body)

    if (error) {
      return badRequest(res, error.message)
    }

    const { cors, headers, query, cookies } = req.body
    updateConfiguration(configuration, cors, headers, query, cookies)

    res.status(200).send(configuration)
  })

  app.delete('/___config', (req, res) => {
    configuration = createConfiguration()
    res.status(204).send()
  })

  app.use(function fixtureHandler(req, res, next) {
    if (req.method === 'OPTIONS' && configuration.cors === '*') {
      return res.set(corsAllowAllHeaders).status(200).send()
    }

    // eslint-disable-next-line no-labels
    fixtureLoop: for (const [fixtureId, fixture] of getFixtureIterator()) {
      const { request, responses } = fixture

      if (!requestPropertyMatch(req, request, 'path') || !requestPropertyMatch(req, request, 'method')) {
        continue
      }

      for (const property of REQUEST_PROPERTIES) {
        if (!requestPropertyMatch(req, request, property)) {
          // eslint-disable-next-line no-labels
          continue fixtureLoop
        }
      }

      const response = responses[0]
      const options = response.options || {}

      const send = () => {
        res.status(response.status || 200)

        // Loop over RESPONSE_PROPERTIES which has the right order
        // avoiding "Can't set headers after they are sent"
        for (const property of RESPONSE_PROPERTIES) {
          if (response[property] !== undefined) {
            useResponseProperties[property](req, res, response[property])
          }
        }

        if (configuration.cors === '*') {
          res.set(corsAllowAllHeaders)
        }
      }

      if (response.options?.delay) {
        setTimeout(send, response.options.delay)
      } else {
        send()
      }

      // The fixture has been or will be consumed
      // When the response is delayed, we need to remove it before it returns
      if (options.lifetime === undefined || options.lifetime === 1) {
        if (responses.length > 1) {
          responses.shift()
        } else {
          removeFixture(fixtureId)
        }
      } else if (options.lifetime > 0) {
        options.lifetime--
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
