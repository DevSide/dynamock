#!/usr/bin/env node

import { createServer } from "../src/createServer.js"

const [, , port, host = '127.0.0.1'] = process.argv

if (!port) {
  throw new Error('Missing argument <port>')
}

const server = createServer()

server.listen(port, host, () => {
  console.log(`dynamock is running on port ${port}...`)
})

function shutDown () {
  console.log('dynamock is shutting down gracefully')
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)
process.on('SIGQUIT', shutDown)
