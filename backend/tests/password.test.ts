import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashPassword, verifyPassword } from '../src/modules/auth/password.js'

describe('password hashing', () => {
  it('hashes and verifies passwords with scrypt', async () => {
    const passwordHash = await hashPassword('valid-password')

    assert.match(passwordHash, /^scrypt:/)
    assert.equal(await verifyPassword('valid-password', passwordHash), true)
    assert.equal(await verifyPassword('invalid-password', passwordHash), false)
  })
})
