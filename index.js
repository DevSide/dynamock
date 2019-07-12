const createFixtureServer = require('./createFixtureServer')

const [, , port] = process.argv

const server = createFixtureServer()

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock server is running on port ${port}...`)
})

function shutDown () {
  console.log('Mock server is shutting down gracefully')
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', shutDown)
process.on('SIGINT', shutDown)
process.on('SIGQUIT', shutDown)
