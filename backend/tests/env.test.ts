import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getConfig } from '../src/config/env.js'

describe('environment configuration', () => {
  it('uses development defaults', () => {
    assert.deepEqual(getConfig({}), {
      nodeEnv: 'development',
      port: 3000,
      corsOrigin: 'http://localhost:5173',
    })
  })

  it('rejects an invalid port', () => {
    assert.throws(
      () => getConfig({ PORT: 'not-a-port' }),
      /PORT must be an integer between 0 and 65535/,
    )
  })
})
