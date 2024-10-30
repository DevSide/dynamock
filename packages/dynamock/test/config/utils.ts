import { createServer } from 'node:net'

const isPortUsed = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', (err: Error) => {
      server.close(() => {
        resolve('code' in err && err.code === 'EADDRINUSE')
      })
    })
    server.once('listening', () => {
      server.close(() => {
        resolve(false)
      })
    })
    server.listen(port)
  })
}

export function waitPortUsed(port: number, retry = 50, reverse = false) {
  return new Promise((resolve) => {
    const loop = async () => {
      const isUsed = await isPortUsed(port)

      // @ts-ignore
      if (!(isUsed ^ !reverse)) {
        return
      }

      // @ts-ignore
      await new Promise((resolve) => setTimeout(resolve, retry))
      return loop()
    }

    loop().then(resolve)
  })
}

export function waitPortFree(port: number, retry?: number) {
  return waitPortUsed(port, retry, true)
}
