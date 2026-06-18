import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getConfig } from '../src/config/env.js'

describe('environment configuration', () => {
  it('uses development defaults', () => {
    assert.deepEqual(getConfig({}), {
      nodeEnv: 'development',
      port: 3000,
      corsOrigin: 'http://localhost:5173',
      sessionCookieName: 'presto_session',
      sessionTtlDays: 7,
      passwordResetTtlMinutes: 60,
    })
  })

  it('rejects an invalid port', () => {
    assert.throws(
      () => getConfig({ PORT: 'not-a-port' }),
      /PORT must be an integer between 0 and 65535/,
    )
  })

  it('rejects invalid auth durations', () => {
    assert.throws(
      () => getConfig({ SESSION_TTL_DAYS: '0' }),
      /SESSION_TTL_DAYS must be a positive integer/,
    )

    assert.throws(
      () => getConfig({ PASSWORD_RESET_TTL_MINUTES: '-1' }),
      /PASSWORD_RESET_TTL_MINUTES must be a positive integer/,
    )
  })
})
