import express, { type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { REQUEST_PROPERTIES, requestPropertyMatch, RESPONSE_PROPERTIES, useResponseProperties } from './properties.js'
import { getFixtureIterator, removeFixture } from './fixtures.js'
import { createServer as createHTTPServer } from 'node:http'
import {
  createService,
  createServiceFixture,
  createServiceFixtures,
  deleteConfiguration,
  deleteServiceFixture,
  deleteServiceFixtures,
  getServiceConfiguration,
  hasServiceCors,
  resetService,
  updateServiceConfiguration,
} from './service.js'

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

  const service = createService()

  app.post('/___fixtures', (req, res) => {
    const [status, data] = createServiceFixture(service, req.body)
    res.status(status).send(data)
  })

  app.post('/___fixtures/bulk', (req, res) => {
    const [status, data] = createServiceFixtures(service, req.body)
    res.status(status).send(data)
  })

  app.delete('/___fixtures', (req, res) => {
    const [status, data] = deleteServiceFixtures(service)
    res.status(status).send(data)
  })

  app.delete('/___fixtures/:id', (req, res) => {
    const [status] = deleteServiceFixture(service, req.params.id)
    res.status(status).send()
  })

  app.get('/___config', (req, res) => {
    const [status, data] = getServiceConfiguration(service)
    res.status(status).send(data)
  })

  app.put('/___config', (req, res) => {
    const [status, data] = updateServiceConfiguration(service, req.body)
    res.status(status).send(data)
  })

  app.delete('/___config', (req, res) => {
    const [status] = deleteConfiguration(service)
    res.status(status).send()
  })

  app.use(function fixtureHandler(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS' && hasServiceCors(service)) {
      res.set(corsAllowAllHeaders).status(200).send()
      return
    }

    fixtureLoop: for (const [fixtureId, fixture] of getFixtureIterator(service.fixtureStorage)) {
      const { request, responses } = fixture
      // console.log("fixtureHandler", request)

      if (!requestPropertyMatch(req, request, 'path') || !requestPropertyMatch(req, request, 'method')) {
        continue
      }

      for (const property of REQUEST_PROPERTIES) {
        if (!requestPropertyMatch(req, request, property)) {
          // console.log("fixtureHandler no match " + property)
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
          if (response[property] !== undefined && property in useResponseProperties) {
            // @ts-ignore
            useResponseProperties[property](req, res, response[property])
          }
        }

        if (service.configuration.cors === '*') {
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
          removeFixture(service.fixtureStorage, fixtureId)
        }
      } else if (options.lifetime > 0) {
        options.lifetime--
      }

      return
    }

    next()
  })

  server.on('close', () => {
    resetService(service)
  })

  return server
}
