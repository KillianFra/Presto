import type { AppConfig } from '../../config/env.js'
import { StorageError } from './storage.errors.js'
import type { SignedDownloadUrlResult, SignedUploadUrlInput, SignedUploadUrlResult, StorageService } from './storage.types.js'

const signedUploadTtlSeconds = 2 * 60 * 60

interface SupabaseStorageServiceOptions {
  fetchImpl?: typeof fetch
  now?: () => Date
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function encodeStoragePath(storageKey: string): string {
  return storageKey.split('/').map(encodeURIComponent).join('/')
}

function readString(payload: unknown, field: string): string | null {
  if (!payload || typeof payload !== 'object') return null

  const value = (payload as Record<string, unknown>)[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}

function ensureSupabaseConfig(config: Readonly<AppConfig>): void {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new StorageError(500, 'Supabase storage is not configured')
  }
}

function makeStorageApiUrl(config: Readonly<AppConfig>): string {
  return `${trimTrailingSlash(config.supabaseUrl)}/storage/v1`
}

function toAbsoluteStorageUrl(storageApiUrl: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value

  return `${storageApiUrl}${value.startsWith('/') ? value : `/${value}`}`
}

export function createSupabaseStorageService(
  config: Readonly<AppConfig>,
  options: SupabaseStorageServiceOptions = {},
): StorageService {
  const fetchImpl = options.fetchImpl || fetch
  const now = options.now || (() => new Date())

  async function postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    ensureSupabaseConfig(config)

    const response = await fetchImpl(`${makeStorageApiUrl(config)}${path}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseServiceRoleKey,
        authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    let payload: unknown = {}

    try {
      payload = await response.json()
    } catch {
      payload = {}
    }

    if (!response.ok) {
      throw new StorageError(502, 'Supabase storage request failed')
    }

    return payload
  }

  return {
    async createSignedUploadUrl(input: SignedUploadUrlInput): Promise<SignedUploadUrlResult> {
      const storageApiUrl = makeStorageApiUrl(config)
      const encodedBucket = encodeURIComponent(config.supabaseStorageBucket)
      const encodedPath = encodeStoragePath(input.storageKey)
      const payload = await postJson(`/object/upload/sign/${encodedBucket}/${encodedPath}`, {
        contentType: input.contentType,
      })
      const signedUrl =
        readString(payload, 'signedUrl') ||
        readString(payload, 'signedURL') ||
        readString(payload, 'url')
      const token = readString(payload, 'token')

      if (!signedUrl && !token) {
        throw new StorageError(502, 'Supabase storage response did not include a signed upload URL')
      }

      const uploadUrl = signedUrl
        ? toAbsoluteStorageUrl(storageApiUrl, signedUrl)
        : `${storageApiUrl}/object/upload/sign/${encodedBucket}/${encodedPath}?token=${encodeURIComponent(token || '')}`

      return {
        uploadUrl,
        expiresAt: addSeconds(now(), signedUploadTtlSeconds),
      }
    },

    async createSignedDownloadUrl(storageKey: string): Promise<SignedDownloadUrlResult> {
      const storageApiUrl = makeStorageApiUrl(config)
      const encodedBucket = encodeURIComponent(config.supabaseStorageBucket)
      const encodedPath = encodeStoragePath(storageKey)
      const payload = await postJson(`/object/sign/${encodedBucket}/${encodedPath}`, {
        expiresIn: config.signedDownloadTtlSeconds,
      })
      const signedUrl =
        readString(payload, 'signedUrl') ||
        readString(payload, 'signedURL') ||
        readString(payload, 'url')

      if (!signedUrl) {
        throw new StorageError(502, 'Supabase storage response did not include a signed download URL')
      }

      return {
        downloadUrl: toAbsoluteStorageUrl(storageApiUrl, signedUrl),
        expiresAt: addSeconds(now(), config.signedDownloadTtlSeconds),
      }
    },
  }
}
