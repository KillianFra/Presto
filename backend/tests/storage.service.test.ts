import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AppConfig } from '../src/config/env.js'
import { StorageError } from '../src/modules/storage/storage.errors.js'
import { createSupabaseStorageService } from '../src/modules/storage/supabase-storage.service.js'

function createConfig(overrides: Partial<AppConfig> = {}): Readonly<AppConfig> {
  return {
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
    ...overrides,
  }
}

describe('supabase storage service', () => {
  it('creates signed upload urls using the private storage API', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init })
      return Response.json({
        signedURL: '/object/upload/sign/presto-assets/users/user-1/projects/project-1/originals/photo%201.jpg?token=upload-token',
      })
    }
    const service = createSupabaseStorageService(createConfig(), {
      fetchImpl,
      now: () => new Date('2026-06-18T12:00:00.000Z'),
    })

    const result = await service.createSignedUploadUrl({
      storageKey: 'users/user-1/projects/project-1/originals/photo 1.jpg',
      contentType: 'image/jpeg',
    })

    assert.deepEqual(result, {
      uploadUrl:
        'https://example.supabase.co/storage/v1/object/upload/sign/presto-assets/users/user-1/projects/project-1/originals/photo%201.jpg?token=upload-token',
      expiresAt: new Date('2026-06-18T14:00:00.000Z'),
    })
    assert.equal(
      requests[0]?.url,
      'https://example.supabase.co/storage/v1/object/upload/sign/presto-assets/users/user-1/projects/project-1/originals/photo%201.jpg',
    )
    assert.equal(requests[0]?.init?.method, 'POST')
    assert.deepEqual(requests[0]?.init?.headers, {
      apikey: 'service-role-key',
      authorization: 'Bearer service-role-key',
      'content-type': 'application/json',
    })
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      contentType: 'image/jpeg',
    })
  })

  it('creates signed download urls with configured expiration', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init })
      return Response.json({
        signedURL: '/object/sign/presto-assets/users/user-1/projects/project-1/originals/photo.jpg?token=download-token',
      })
    }
    const service = createSupabaseStorageService(createConfig({ signedDownloadTtlSeconds: 120 }), {
      fetchImpl,
      now: () => new Date('2026-06-18T12:00:00.000Z'),
    })

    const result = await service.createSignedDownloadUrl('users/user-1/projects/project-1/originals/photo.jpg')

    assert.deepEqual(result, {
      downloadUrl:
        'https://example.supabase.co/storage/v1/object/sign/presto-assets/users/user-1/projects/project-1/originals/photo.jpg?token=download-token',
      expiresAt: new Date('2026-06-18T12:02:00.000Z'),
    })
    assert.equal(
      requests[0]?.url,
      'https://example.supabase.co/storage/v1/object/sign/presto-assets/users/user-1/projects/project-1/originals/photo.jpg',
    )
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      expiresIn: 120,
    })
  })

  it('fails clearly when Supabase storage is not configured', async () => {
    const service = createSupabaseStorageService(createConfig({ supabaseUrl: '', supabaseServiceRoleKey: '' }))

    await assert.rejects(
      () => service.createSignedDownloadUrl('users/user-1/projects/project-1/originals/photo.jpg'),
      (error: unknown) => {
        assert.ok(error instanceof StorageError)
        assert.equal(error.statusCode, 500)
        assert.equal(error.message, 'Supabase storage is not configured')
        return true
      },
    )
  })
})
