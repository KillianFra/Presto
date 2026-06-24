import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { createApp } from '../src/app.js'
import { AuthError } from '../src/modules/auth/auth.errors.js'
import type {
  AuthService,
  AuthSessionResult,
  AuthUser,
  LoginInput,
  PasswordResetResult,
  RegisterInput,
} from '../src/modules/auth/auth.types.js'
import type { Logger } from '../src/types/logger.js'

const silentLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
}

const testUser: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
}

function createSessionResult(user: AuthUser = testUser): AuthSessionResult {
  return {
    user,
    token: 'session-token',
    expiresAt: new Date('2026-06-18T12:00:00.000Z'),
  }
}

class FakeAuthService implements AuthService {
  registerInput?: RegisterInput
  loginInput?: LoginInput
  logoutToken?: string | null
  currentUserToken?: string | null
  passwordResetEmail?: string
  resetPasswordInput?: { token: string, password: string }
  registerResult = createSessionResult()
  loginResult = createSessionResult()
  currentUser: AuthUser | null = testUser
  passwordResetResult: PasswordResetResult = { resetToken: 'reset-token' }
  loginError?: AuthError

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    this.registerInput = input
    return this.registerResult
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    this.loginInput = input

    if (this.loginError) {
      throw this.loginError
    }

    return this.loginResult
  }

  async logout(token: string | null): Promise<void> {
    this.logoutToken = token
  }

  async getCurrentUser(token: string | null): Promise<AuthUser | null> {
    this.currentUserToken = token
    return this.currentUser
  }

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    this.passwordResetEmail = email
    return this.passwordResetResult
  }

  async resetPassword(token: string, password: string): Promise<void> {
    this.resetPasswordInput = { token, password }
  }
}

describe('auth routes', () => {
  let server: Server
  let baseUrl: string
  let authService: FakeAuthService

  before(async () => {
    authService = new FakeAuthService()
    const app = createApp({
      config: {
        nodeEnv: 'test',
        port: 0,
        corsOrigin: 'http://localhost:5173',
        sessionCookieName: 'presto_session',
        sessionTtlDays: 7,
        passwordResetTtlMinutes: 60,
      },
      logger: silentLogger,
      authService,
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

  it('registers a user and sets an HTTP-only session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'USER@example.com',
        password: 'valid-password',
      }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(authService.registerInput, {
      email: 'USER@example.com',
      password: 'valid-password',
    })
    assert.deepEqual(await response.json(), { user: testUser })

    const setCookie = response.headers.get('set-cookie')
    assert.match(setCookie ?? '', /presto_session=session-token/)
    assert.match(setCookie ?? '', /HttpOnly/)
    assert.match(setCookie ?? '', /SameSite=Lax/)
  })

  it('returns the current user from the session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: 'presto_session=session-token',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(authService.currentUserToken, 'session-token')
    assert.deepEqual(await response.json(), { user: testUser })
  })

  it('rejects requests without a valid session', async () => {
    authService.currentUser = null

    const response = await fetch(`${baseUrl}/api/auth/me`)

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: {
        message: 'Authentication required',
      },
    })

    authService.currentUser = testUser
  })

  it('returns auth errors from the login service', async () => {
    authService.loginError = new AuthError(401, 'Invalid email or password')

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: {
        message: 'Invalid email or password',
      },
    })

    authService.loginError = undefined
  })

  it('logs out and clears the session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: 'presto_session=session-token',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(authService.logoutToken, 'session-token')
    assert.match(response.headers.get('set-cookie') ?? '', /presto_session=/)
  })

  it('prepares password reset tokens outside production', async () => {
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    assert.equal(response.status, 202)
    assert.equal(authService.passwordResetEmail, 'user@example.com')
    assert.deepEqual(await response.json(), {
      message: 'If an account exists, a password reset has been prepared.',
      resetToken: 'reset-token',
    })
  })

  it('resets a password from a reset token', async () => {
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'reset-token',
        password: 'new-password',
      }),
    })

    assert.equal(response.status, 204)
    assert.deepEqual(authService.resetPasswordInput, {
      token: 'reset-token',
      password: 'new-password',
    })
  })
})
