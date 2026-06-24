import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AssetKind, ProjectStatus, ProjectVertical, type PrismaClient } from '@prisma/client'
import type { AppConfig } from '../src/config/env.js'
import { ProjectError } from '../src/modules/projects/project.errors.js'
import { createProjectService } from '../src/modules/projects/project.service.js'
import type { StorageService, SignedDownloadUrlResult, SignedUploadUrlInput, SignedUploadUrlResult } from '../src/modules/storage/storage.types.js'

const createdAt = new Date('2026-06-18T12:00:00.000Z')
const updatedAt = new Date('2026-06-18T12:00:00.000Z')

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

class FakeStorageService implements StorageService {
  uploadInput?: SignedUploadUrlInput
  downloadStorageKey?: string

  async createSignedUploadUrl(input: SignedUploadUrlInput): Promise<SignedUploadUrlResult> {
    this.uploadInput = input
    return {
      uploadUrl: 'https://example.supabase.co/storage/v1/upload',
      expiresAt: new Date('2026-06-18T14:00:00.000Z'),
    }
  }

  async createSignedDownloadUrl(storageKey: string): Promise<SignedDownloadUrlResult> {
    this.downloadStorageKey = storageKey
    return {
      downloadUrl: 'https://example.supabase.co/storage/v1/download',
      expiresAt: new Date('2026-06-18T12:15:00.000Z'),
    }
  }
}

function createPrismaMock(options: { projectFound?: boolean } = {}) {
  const calls: Record<string, unknown> = {}
  const project = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Appartement',
    vertical: ProjectVertical.IMMOBILIER,
    status: ProjectStatus.DRAFT,
    createdAt,
    updatedAt,
  }
  const asset = {
    id: 'asset-1',
    projectId: 'project-1',
    kind: AssetKind.ORIGINAL,
    storageKey: 'users/user-1/projects/project-1/originals/photo.jpg',
    mimeType: 'image/jpeg',
    byteSize: 120000,
    expiresAt: new Date('2026-07-18T12:00:00.000Z'),
    deletedAt: null,
    createdAt,
  }
  const projectFound = options.projectFound ?? true
  const prisma = {
    project: {
      findFirst: async (args: unknown) => {
        calls.projectFindFirst = args
        return projectFound ? project : null
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.projectCreate = args
        return { ...project, ...args.data }
      },
      update: async (args: { data: Record<string, unknown> }) => {
        calls.projectUpdate = args
        return { ...project, ...args.data }
      },
      findMany: async (args: unknown) => {
        calls.projectFindMany = args
        return [project]
      },
    },
    asset: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.assetCreate = args
        return { ...asset, ...args.data }
      },
      findMany: async (args: unknown) => {
        calls.assetFindMany = args
        return [asset]
      },
      findFirst: async (args: unknown) => {
        calls.assetFindFirst = args
        return asset
      },
    },
  } as unknown as PrismaClient

  return { prisma, calls }
}

describe('project service', () => {
  it('creates projects with normalized input and owner id', async () => {
    const { prisma, calls } = createPrismaMock()
    const storage = new FakeStorageService()
    const service = createProjectService(prisma, storage, createConfig())

    const project = await service.createProject('user-1', {
      title: '  Appartement renove  ',
      vertical: 'objet',
    })

    assert.deepEqual(calls.projectCreate, {
      data: {
        userId: 'user-1',
        title: 'Appartement renove',
        vertical: ProjectVertical.OBJET,
      },
    })
    assert.equal(project.userId, 'user-1')
    assert.equal(project.title, 'Appartement renove')
    assert.equal(project.vertical, ProjectVertical.OBJET)
  })

  it('checks project ownership before creating signed upload urls', async () => {
    const { prisma, calls } = createPrismaMock()
    const storage = new FakeStorageService()
    const service = createProjectService(prisma, storage, createConfig())

    const upload = await service.createOriginalUploadUrl('user-1', 'project-1', {
      fileName: 'Salon principal.JPG',
      mimeType: 'image/jpeg',
      byteSize: 120000,
    })

    assert.deepEqual(calls.projectFindFirst, {
      where: {
        id: 'project-1',
        userId: 'user-1',
        status: { not: ProjectStatus.DELETED },
      },
    })
    assert.match(upload.storageKey, /^users\/user-1\/projects\/project-1\/originals\/.+-salon-principal\.jpg$/)
    assert.deepEqual(storage.uploadInput, {
      storageKey: upload.storageKey,
      contentType: 'image/jpeg',
    })
  })

  it('rejects storage keys outside the authenticated project scope', async () => {
    const { prisma, calls } = createPrismaMock()
    const storage = new FakeStorageService()
    const service = createProjectService(prisma, storage, createConfig())

    await assert.rejects(
      () => service.confirmOriginalAsset('user-1', 'project-1', {
        storageKey: 'users/user-2/projects/project-2/originals/photo.jpg',
        mimeType: 'image/jpeg',
        byteSize: 120000,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ProjectError)
        assert.equal(error.statusCode, 400)
        assert.equal(error.message, 'Asset storage key does not belong to this project')
        return true
      },
    )
    assert.equal(calls.assetCreate, undefined)
  })

  it('returns not found when a project is not owned by the user', async () => {
    const { prisma } = createPrismaMock({ projectFound: false })
    const storage = new FakeStorageService()
    const service = createProjectService(prisma, storage, createConfig())

    await assert.rejects(
      () => service.getProject('user-1', 'project-1'),
      (error: unknown) => {
        assert.ok(error instanceof ProjectError)
        assert.equal(error.statusCode, 404)
        assert.equal(error.message, 'Project not found')
        return true
      },
    )
  })
})
