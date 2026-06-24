import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { AssetKind, ProjectStatus, ProjectVertical } from '@prisma/client'
import { createApp } from '../src/app.js'
import type {
  AuthService,
  AuthSessionResult,
  AuthUser,
  LoginInput,
  PasswordResetResult,
  RegisterInput,
} from '../src/modules/auth/auth.types.js'
import { ProjectError } from '../src/modules/projects/project.errors.js'
import type {
  AssetDto,
  ConfirmOriginalAssetInput,
  CreateOriginalUploadInput,
  CreateProjectInput,
  ProjectDetailsDto,
  ProjectDto,
  ProjectService,
  SignedAssetDownloadDto,
  SignedOriginalUploadDto,
  UpdateProjectInput,
} from '../src/modules/projects/project.types.js'
import type { Logger } from '../src/types/logger.js'

const silentLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
}

const testUser: AuthUser = {
  id: 'user-1',
  email: 'user@example.com',
}

const projectDto: ProjectDto = {
  id: 'project-1',
  userId: testUser.id,
  title: 'Appartement lumineux',
  vertical: ProjectVertical.IMMOBILIER,
  status: ProjectStatus.DRAFT,
  createdAt: '2026-06-18T12:00:00.000Z',
  updatedAt: '2026-06-18T12:00:00.000Z',
}

const assetDto: AssetDto = {
  id: 'asset-1',
  projectId: projectDto.id,
  kind: AssetKind.ORIGINAL,
  storageKey: `users/${testUser.id}/projects/${projectDto.id}/originals/photo.jpg`,
  mimeType: 'image/jpeg',
  byteSize: 120_000,
  expiresAt: '2026-07-18T12:00:00.000Z',
  deletedAt: null,
  createdAt: '2026-06-18T12:00:00.000Z',
}

function createSessionResult(user: AuthUser = testUser): AuthSessionResult {
  return {
    user,
    token: 'session-token',
    expiresAt: new Date('2026-06-18T12:00:00.000Z'),
  }
}

class FakeAuthService implements AuthService {
  currentUser: AuthUser | null = testUser
  currentUserToken?: string | null

  async register(_input: RegisterInput): Promise<AuthSessionResult> {
    return createSessionResult()
  }

  async login(_input: LoginInput): Promise<AuthSessionResult> {
    return createSessionResult()
  }

  async logout(_token: string | null): Promise<void> {}

  async getCurrentUser(token: string | null): Promise<AuthUser | null> {
    this.currentUserToken = token
    return this.currentUser
  }

  async requestPasswordReset(_email: string): Promise<PasswordResetResult> {
    return {}
  }

  async resetPassword(_token: string, _password: string): Promise<void> {}
}

class FakeProjectService implements ProjectService {
  listProjectsUserId?: string
  createProjectInput?: { userId: string, input: CreateProjectInput }
  getProjectInput?: { userId: string, projectId: string }
  updateProjectInput?: { userId: string, projectId: string, input: UpdateProjectInput }
  deleteProjectInput?: { userId: string, projectId: string }
  uploadInput?: { userId: string, projectId: string, input: CreateOriginalUploadInput }
  confirmInput?: { userId: string, projectId: string, input: ConfirmOriginalAssetInput }
  listAssetsInput?: { userId: string, projectId: string }
  downloadInput?: { userId: string, projectId: string, assetId: string }
  nextError?: ProjectError

  private maybeThrow(): void {
    if (this.nextError) {
      const error = this.nextError
      this.nextError = undefined
      throw error
    }
  }

  async listProjects(userId: string): Promise<ProjectDto[]> {
    this.maybeThrow()
    this.listProjectsUserId = userId
    return [projectDto]
  }

  async createProject(userId: string, input: CreateProjectInput): Promise<ProjectDto> {
    this.maybeThrow()
    this.createProjectInput = { userId, input }
    return { ...projectDto, title: input.title, vertical: input.vertical as ProjectVertical }
  }

  async getProject(userId: string, projectId: string): Promise<ProjectDetailsDto> {
    this.maybeThrow()
    this.getProjectInput = { userId, projectId }
    return { ...projectDto, id: projectId, assets: [assetDto] }
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
    this.maybeThrow()
    this.updateProjectInput = { userId, projectId, input }
    return {
      ...projectDto,
      id: projectId,
      title: input.title ?? projectDto.title,
      vertical: input.vertical ? input.vertical as ProjectVertical : projectDto.vertical,
    }
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    this.maybeThrow()
    this.deleteProjectInput = { userId, projectId }
  }

  async createOriginalUploadUrl(
    userId: string,
    projectId: string,
    input: CreateOriginalUploadInput,
  ): Promise<SignedOriginalUploadDto> {
    this.maybeThrow()
    this.uploadInput = { userId, projectId, input }
    return {
      storageKey: assetDto.storageKey,
      uploadUrl: 'https://example.supabase.co/storage/v1/upload',
      expiresAt: '2026-06-18T14:00:00.000Z',
    }
  }

  async confirmOriginalAsset(
    userId: string,
    projectId: string,
    input: ConfirmOriginalAssetInput,
  ): Promise<AssetDto> {
    this.maybeThrow()
    this.confirmInput = { userId, projectId, input }
    return { ...assetDto, projectId }
  }

  async listAssets(userId: string, projectId: string): Promise<AssetDto[]> {
    this.maybeThrow()
    this.listAssetsInput = { userId, projectId }
    return [assetDto]
  }

  async createAssetDownloadUrl(userId: string, projectId: string, assetId: string): Promise<SignedAssetDownloadDto> {
    this.maybeThrow()
    this.downloadInput = { userId, projectId, assetId }
    return {
      asset: { ...assetDto, id: assetId, projectId },
      downloadUrl: 'https://example.supabase.co/storage/v1/download',
      expiresAt: '2026-06-18T12:15:00.000Z',
    }
  }
}

describe('project routes', () => {
  let server: Server
  let baseUrl: string
  let authService: FakeAuthService
  let projectService: FakeProjectService

  before(async () => {
    authService = new FakeAuthService()
    projectService = new FakeProjectService()

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
      authService,
      projectService,
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

  it('requires authentication for project routes', async () => {
    authService.currentUser = null

    const response = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: { message: 'Authentication required' },
    })

    authService.currentUser = testUser
  })

  it('creates projects for the authenticated user', async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({
        title: 'Studio meuble',
        vertical: 'OBJET',
      }),
    })

    assert.equal(response.status, 201)
    assert.equal(authService.currentUserToken, 'session-token')
    assert.deepEqual(projectService.createProjectInput, {
      userId: testUser.id,
      input: {
        title: 'Studio meuble',
        vertical: 'OBJET',
      },
    })
    assert.deepEqual(await response.json(), {
      project: { ...projectDto, title: 'Studio meuble', vertical: 'OBJET' },
    })
  })

  it('lists projects and project details', async () => {
    const listResponse = await fetch(`${baseUrl}/api/projects`, {
      headers: { Cookie: 'presto_session=session-token' },
    })
    assert.equal(listResponse.status, 200)
    assert.equal(projectService.listProjectsUserId, testUser.id)
    assert.deepEqual(await listResponse.json(), { projects: [projectDto] })

    const detailResponse = await fetch(`${baseUrl}/api/projects/project-2`, {
      headers: { Cookie: 'presto_session=session-token' },
    })
    assert.equal(detailResponse.status, 200)
    assert.deepEqual(projectService.getProjectInput, {
      userId: testUser.id,
      projectId: 'project-2',
    })
    assert.deepEqual(await detailResponse.json(), {
      project: { ...projectDto, id: 'project-2', assets: [assetDto] },
    })
  })

  it('updates and deletes projects', async () => {
    const updateResponse = await fetch(`${baseUrl}/api/projects/project-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({ title: 'Titre ajuste' }),
    })

    assert.equal(updateResponse.status, 200)
    assert.deepEqual(projectService.updateProjectInput, {
      userId: testUser.id,
      projectId: 'project-1',
      input: { title: 'Titre ajuste', vertical: undefined },
    })
    assert.deepEqual(await updateResponse.json(), {
      project: { ...projectDto, title: 'Titre ajuste' },
    })

    const deleteResponse = await fetch(`${baseUrl}/api/projects/project-1`, {
      method: 'DELETE',
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(deleteResponse.status, 204)
    assert.deepEqual(projectService.deleteProjectInput, {
      userId: testUser.id,
      projectId: 'project-1',
    })
  })

  it('creates signed upload urls and confirms original assets', async () => {
    const uploadResponse = await fetch(`${baseUrl}/api/projects/project-1/assets/original/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        byteSize: 120000,
      }),
    })

    assert.equal(uploadResponse.status, 201)
    assert.deepEqual(projectService.uploadInput, {
      userId: testUser.id,
      projectId: 'project-1',
      input: {
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        byteSize: 120000,
      },
    })
    assert.deepEqual(await uploadResponse.json(), {
      upload: {
        storageKey: assetDto.storageKey,
        uploadUrl: 'https://example.supabase.co/storage/v1/upload',
        expiresAt: '2026-06-18T14:00:00.000Z',
      },
    })

    const confirmResponse = await fetch(`${baseUrl}/api/projects/project-1/assets/original`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'presto_session=session-token',
      },
      body: JSON.stringify({
        storageKey: assetDto.storageKey,
        mimeType: 'image/jpeg',
        byteSize: 120000,
      }),
    })

    assert.equal(confirmResponse.status, 201)
    assert.deepEqual(projectService.confirmInput, {
      userId: testUser.id,
      projectId: 'project-1',
      input: {
        storageKey: assetDto.storageKey,
        mimeType: 'image/jpeg',
        byteSize: 120000,
      },
    })
    assert.deepEqual(await confirmResponse.json(), {
      asset: assetDto,
    })
  })

  it('lists assets and returns signed download urls', async () => {
    const assetsResponse = await fetch(`${baseUrl}/api/projects/project-1/assets`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(assetsResponse.status, 200)
    assert.deepEqual(projectService.listAssetsInput, {
      userId: testUser.id,
      projectId: 'project-1',
    })
    assert.deepEqual(await assetsResponse.json(), { assets: [assetDto] })

    const downloadResponse = await fetch(`${baseUrl}/api/projects/project-1/assets/asset-2/download-url`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(downloadResponse.status, 200)
    assert.deepEqual(projectService.downloadInput, {
      userId: testUser.id,
      projectId: 'project-1',
      assetId: 'asset-2',
    })
    assert.deepEqual(await downloadResponse.json(), {
      download: {
        asset: { ...assetDto, id: 'asset-2', projectId: 'project-1' },
        downloadUrl: 'https://example.supabase.co/storage/v1/download',
        expiresAt: '2026-06-18T12:15:00.000Z',
      },
    })
  })

  it('returns project service errors consistently', async () => {
    projectService.nextError = new ProjectError(404, 'Project not found')

    const response = await fetch(`${baseUrl}/api/projects/missing-project`, {
      headers: { Cookie: 'presto_session=session-token' },
    })

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      error: { message: 'Project not found' },
    })
  })
})
