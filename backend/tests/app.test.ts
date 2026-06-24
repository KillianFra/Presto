import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import type { Server } from 'node:http'
import { createApp } from '../src/app.js'
import type { Logger } from '../src/types/logger.js'

const silentLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
}

describe('Presto API foundation', () => {
  let server: Server
  let baseUrl: string

  before(async () => {
    const app = createApp({
      config: {
        nodeEnv: 'test',
        port: 0,
        corsOrigin: 'http://localhost:5173',
          sessionCookieName: 'presto_session',
          sessionTtlDays: 7,
          passwordResetTtlMinutes: 60,
          supabaseUrl: 'https://example.supabase.co',
          supabaseServiceRoleKey: 'service-role-key',
          supabaseStorageBucket: 'presto-assets',
          signedDownloadTtlSeconds: 900,
          originalAssetTtlDays: 30,
          maxImageByteSize: 10 * 1024 * 1024,
        },
        logger: silentLogger,
      })

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', (error?: Error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  it('exposes an API health endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-powered-by'), null)
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    )
    assert.deepEqual(await response.json(), {
      service: 'presto-api',
      status: 'ok',
    })
  })

  it('returns a consistent response for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/api/not-found`)

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: {
        message: 'Route GET /api/not-found not found',
      },
    })
  })

  it('returns a client error for invalid JSON requests', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: {
        message: 'Invalid JSON body',
      },
    })
  })
})
