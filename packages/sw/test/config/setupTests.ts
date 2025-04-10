import puppeteer, { type Browser, type Page } from 'puppeteer'
import { afterAll, afterEach, beforeAll, beforeEach } from '@jest/globals'
import { createServer as createHTTPServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let browser: Browser
let page: Page
let server: Server

beforeAll(async () => {
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:3000',
      '--allow-insecure-localhost',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  })

  let swContentScriptCache = ''
  let clientContentScriptCache = ''

  server = createHTTPServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/___sw.js') {
      if (!swContentScriptCache) {
        swContentScriptCache = readFileSync(`${__dirname}/../../dist/sw.js`, 'utf-8')
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' })
      res.end(swContentScriptCache)
    } else if (req.method === 'GET' && req.url === '/___client.js') {
      if (!clientContentScriptCache) {
        clientContentScriptCache = readFileSync(`${__dirname}/../../dist/client.js`, 'utf-8')
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      res.end(clientContentScriptCache)
    } else if (req.method === 'GET' && req.url === '/index.html') {
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
  // page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
})

afterEach(async () => {
  await browser.deleteCookie(...(await browser.cookies()))
  await page.close()
})

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve(true)))
  await browser.close()
})

export { page }
