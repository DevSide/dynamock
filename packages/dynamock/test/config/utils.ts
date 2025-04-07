import { spawn } from 'node:child_process'

const isPortUsed = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-i', `:${port}`])

    let output = ''
    lsof.stdout.on('data', (data) => {
      output += data.toString()
    })

    lsof.stderr.on('data', (data) => {
      console.error(`isPortUsed error: ${data}`)
    })

    lsof.on('close', () => {
      const inUse = output.trim().length > 0
      resolve(inUse)
    })
  })
}

export async function waitPortUsed(port: number, retry = 10, timeout = 2000, waitUsed = true) {
  const startTime = Date.now()

  while (true) {
    const isUsed = await isPortUsed(port)

    if (isUsed === waitUsed) {
      return
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for port ${port} to be ${waitUsed ? 'used' : 'free'}`)
    }

    await new Promise((resolve) => setTimeout(resolve, retry))
  }
}

export function waitPortFree(port: number, retry?: number, timeout?: number) {
  return waitPortUsed(port, retry, timeout, false)
}
