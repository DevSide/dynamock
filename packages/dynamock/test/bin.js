import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import assert from 'node:assert'

const isPortUsed = async (port) => {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', (err) => {
      server.close()
      resolve(err.code === 'EADDRINUSE')
    })
    server.once('listening', () => {
      server.close()
      resolve(false)
    })
    server.listen(port)
  })
}

function waitPortUsed(port, retry = 1000) {
  return new Promise((resolve) => {
    const loop = async () => {
      const isUsed = await isPortUsed(port)
      if (isUsed) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, retry))
      return loop()
    }

    loop().then(resolve)
  })
}

async function test(port) {
  let response = await fetch(`http://localhost:${port}/___fixtures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request: {
        method: 'GET',
        path: '/pandas/1',
      },
      response: {
        body: {
          id: 1,
        },
      },
    }),
  })

  assert.strictEqual(response.status, 201)
  let result = await response.json()
  assert.deepStrictEqual(result, { id: 'b84c8ae43356d68d8802a74226a5e7c12d95e3d3' })

  response = await fetch('http://localhost:5000/pandas/1', {
    method: 'GET',
  })

  assert.strictEqual(response.headers['x-powered-by'], undefined)
  assert.strictEqual(response.headers.etag, undefined)
  assert.strictEqual(response.status, 200)
  result = await response.json()
  assert.deepStrictEqual(result, { id: 1 })
}

async function main() {
  const PORT = 5000
  const process = spawn('dynamock', [PORT], { stdio: 'inherit' })

  const kill = () => {
    process.kill('SIGHUP')
  }

  process.on('SIGTERM', kill)
  process.on('SIGINT', kill)
  process.on('SIGQUIT', kill)

  try {
    await waitPortUsed(PORT)
    await test(PORT)
    kill()
  } catch (error) {
    kill()
    throw error
  }
}

main().then(
  () => {
    console.log('Tests succeeded')
    process.exit(0)
  },
  (error) => {
    console.error('Tests failed.')
    console.error(error)
    process.exit(1)
  },
)
