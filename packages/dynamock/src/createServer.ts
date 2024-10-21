import express, { type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { createServer as createHTTPServer } from 'node:http'
import {
  createService,
  createServiceFixture,
  createServiceFixtures,
  deleteConfiguration,
  deleteServiceFixture,
  deleteServiceFixtures,
  getServiceConfiguration,
  resetService,
  updateServiceConfiguration,
  type CoreRequest,
  type CoreResponse,
  matchServiceRequestAgainstFixtures,
} from '@dynamock/core'
import { mapToCoreRequest } from './mapper.js'

export function createServer() {
  const app = express()
  const server = createHTTPServer(app)

  app.use(express.json({ limit: '10mb' }))
  app.use(cookieParser())
  app.disable('x-powered-by')
  app.disable('etag')

  const service = createService()

  app.post('/___fixtures', (req, res) => {
    if (typeof req.body?.request === 'object') {
      req.body.request.origin = `${req.protocol}://${req.get('host')}`
    }
    const [status, data] = createServiceFixture(service, req.body)
    res.status(status).send(data)
  })

  app.post('/___fixtures/bulk', (req, res) => {
    if (Array.isArray(req.body)) {
      for (const fixture of req.body) {
        if (typeof fixture?.request === 'object') {
          fixture.request.origin = `${req.protocol}://${req.get('host')}`
        }
      }
    }
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

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const coreRequest: CoreRequest = mapToCoreRequest(req)

    const didMatch = matchServiceRequestAgainstFixtures(service, coreRequest, (coreResponse: CoreResponse) => {
      const { status, filepath, body, cookies } = coreResponse
      res.status(status).set(coreResponse.headers)

      for (const key in cookies) {
        res.cookie(key, cookies[key])
      }

      if (filepath) {
        res.sendFile(filepath)
      } else {
        res.send(body)
      }
    })

    if (didMatch) {
      return
    }

    next()
  })

  server.on('close', () => {
    resetService(service)
  })

  return server
}
