import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from "node:assert";

const isPortUsed = async (port) => {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err) => {
      server.close();
      resolve(err["code"] === "EADDRINUSE");
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function waitPortUsed (port, retry = 1000) {
  return new Promise(async (resolve) => {
    do {
      await new Promise(resolve => setTimeout(resolve, retry))
      console.log(`Waiting for port ${port}...`)
    } while (!await isPortUsed(port))
    resolve()
  })
}

async function test (port) {
  let response = await fetch(`http://localhost:${port}/___fixtures`, {
    method: `POST`,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request: {
        method: `GET`,
        path: `/pandas/1`
      },
      response: {
        body: {
          id: 1
        }
      }
    })
  })

  assert.strictEqual(response.status, 201)
  let result = await response.json()
  assert.deepStrictEqual(result, { id: `db7d555f28bce97730a0589add9e2ba42b395a74` })

  response = await fetch(`http://localhost:5000/pandas/1`, {
    method: `GET`,
  })

  assert.strictEqual(response.status, 200)
  result = await response.json()
  assert.deepStrictEqual(result, { id: 1 })
}

async function main() {
  const PORT = 5000
  const process = spawn(`dynamock`, [PORT], { stdio: 'inherit' })

  const kill = () => {
    process.kill('SIGHUP');
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
    console.log("Tests succeeded")
    process.exit(0)
  },
  (error) => {
    console.error("Tests failed.")
    console.error(error)
    process.exit(1)
  },
)