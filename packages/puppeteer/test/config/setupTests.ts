import puppeteer, { type Browser, type Page } from 'puppeteer'
import { afterAll, afterEach, beforeAll, beforeEach } from '@jest/globals'
import {
  createServer as createHTTPServer,
  request,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http'

let browser: Browser
let page: Page
let server: Server

beforeAll(async () => {
  browser = await puppeteer.launch()
  server = createHTTPServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!DOCTYPE html><html lang="en"><body></body></html>`)
    } else if (req.method === 'GET' && req.url === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('')
    } else {
      res.writeHead(404).end()
    }
  })
  await new Promise((resolve) => server.listen(3000, '127.0.0.1', () => resolve(true)))
})

beforeEach(async () => {
  page = await browser.newPage()
})

afterEach(async () => {
  await page.deleteCookie(...(await page.cookies()))
  await page.close()
})

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve(true)))
  await browser.close()
})

export { page }
