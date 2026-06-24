import { randomUUID } from 'node:crypto'
import { AssetKind, Prisma, ProjectStatus, ProjectVertical, type PrismaClient } from '@prisma/client'
import type { AppConfig } from '../../config/env.js'
import type { StorageService } from '../storage/storage.types.js'
import { ProjectError } from './project.errors.js'
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
} from './project.types.js'

const titleMaxLength = 160
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

interface ProjectRecord {
  id: string
  userId: string
  title: string
  vertical: ProjectVertical
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

interface AssetRecord {
  id: string
  projectId: string
  kind: AssetKind
  storageKey: string
  mimeType: string
  byteSize: number | null
  expiresAt: Date | null
  deletedAt: Date | null
  createdAt: Date
}

function normalizeTitle(title: string): string {
  const normalizedTitle = title.trim()

  if (!normalizedTitle) {
    throw new ProjectError(400, 'Project title is required')
  }

  if (normalizedTitle.length > titleMaxLength) {
    throw new ProjectError(400, `Project title must contain at most ${titleMaxLength} characters`)
  }

  return normalizedTitle
}

function normalizeVertical(vertical: string): ProjectVertical {
  const normalizedVertical = vertical.trim().toUpperCase()
  const availableVerticals = Object.values(ProjectVertical) as string[]

  if (!availableVerticals.includes(normalizedVertical)) {
    throw new ProjectError(400, 'Project vertical must be IMMOBILIER or OBJET')
  }

  return normalizedVertical as ProjectVertical
}

function validateMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.trim().toLowerCase()

  if (!allowedImageMimeTypes.has(normalizedMimeType)) {
    throw new ProjectError(400, 'Asset mime type must be image/jpeg, image/png or image/webp')
  }

  return normalizedMimeType
}

function validateByteSize(byteSize: number, maxImageByteSize: number): number {
  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    throw new ProjectError(400, 'Asset byte size must be a positive integer')
  }

  if (byteSize > maxImageByteSize) {
    throw new ProjectError(400, `Asset byte size must not exceed ${maxImageByteSize} bytes`)
  }

  return byteSize
}

function sanitizeFileName(fileName: string, mimeType: string): string {
  const sanitizedFileName = fileName
    .trim()
    .toLowerCase()
    .replace(/[/\\]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')

  return sanitizedFileName || `original${extensionByMimeType[mimeType] || ''}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function originalStoragePrefix(userId: string, projectId: string): string {
  return `users/${userId}/projects/${projectId}/originals/`
}

function createOriginalStorageKey(userId: string, projectId: string, fileName: string, mimeType: string): string {
  return `${originalStoragePrefix(userId, projectId)}${randomUUID()}-${sanitizeFileName(fileName, mimeType)}`
}

function validateOriginalStorageKey(userId: string, projectId: string, storageKey: string): string {
  const normalizedStorageKey = storageKey.trim()

  if (
    !normalizedStorageKey.startsWith(originalStoragePrefix(userId, projectId)) ||
    normalizedStorageKey.includes('..')
  ) {
    throw new ProjectError(400, 'Asset storage key does not belong to this project')
  }

  return normalizedStorageKey
}

function toProjectDto(project: ProjectRecord): ProjectDto {
  return {
    id: project.id,
    userId: project.userId,
    title: project.title,
    vertical: project.vertical,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function toAssetDto(asset: AssetRecord): AssetDto {
  return {
    id: asset.id,
    projectId: asset.projectId,
    kind: asset.kind,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    expiresAt: asset.expiresAt?.toISOString() || null,
    deletedAt: asset.deletedAt?.toISOString() || null,
    createdAt: asset.createdAt.toISOString(),
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export function createProjectService(
  prisma: PrismaClient,
  storageService: StorageService,
  config: Readonly<AppConfig>,
): ProjectService {
  async function findProjectForUser(userId: string, projectId: string): Promise<ProjectRecord> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
        status: { not: ProjectStatus.DELETED },
      },
    })

    if (!project) {
      throw new ProjectError(404, 'Project not found')
    }

    return project
  }

  return {
    async listProjects(userId: string): Promise<ProjectDto[]> {
      const projects = await prisma.project.findMany({
        where: {
          userId,
          status: { not: ProjectStatus.DELETED },
        },
        orderBy: { createdAt: 'desc' },
      })

      return projects.map(toProjectDto)
    },

    async createProject(userId: string, input: CreateProjectInput): Promise<ProjectDto> {
      const project = await prisma.project.create({
        data: {
          userId,
          title: normalizeTitle(input.title),
          vertical: normalizeVertical(input.vertical),
        },
      })

      return toProjectDto(project)
    },

    async getProject(userId: string, projectId: string): Promise<ProjectDetailsDto> {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId,
          status: { not: ProjectStatus.DELETED },
        },
        include: {
          assets: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (!project) {
        throw new ProjectError(404, 'Project not found')
      }

      return {
        ...toProjectDto(project),
        assets: project.assets.map(toAssetDto),
      }
    },

    async updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
      await findProjectForUser(userId, projectId)

      const data: Prisma.ProjectUpdateInput = {}

      if (typeof input.title === 'string') {
        data.title = normalizeTitle(input.title)
      }

      if (typeof input.vertical === 'string') {
        data.vertical = normalizeVertical(input.vertical)
      }

      if (Object.keys(data).length === 0) {
        return toProjectDto(await findProjectForUser(userId, projectId))
      }

      const project = await prisma.project.update({
        where: { id: projectId },
        data,
      })

      return toProjectDto(project)
    },

    async deleteProject(userId: string, projectId: string): Promise<void> {
      await findProjectForUser(userId, projectId)

      await prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.DELETED },
      })
    },

    async createOriginalUploadUrl(
      userId: string,
      projectId: string,
      input: CreateOriginalUploadInput,
    ): Promise<SignedOriginalUploadDto> {
      await findProjectForUser(userId, projectId)

      const mimeType = validateMimeType(input.mimeType)
      validateByteSize(input.byteSize, config.maxImageByteSize)

      const storageKey = createOriginalStorageKey(userId, projectId, input.fileName, mimeType)
      const signedUpload = await storageService.createSignedUploadUrl({
        storageKey,
        contentType: mimeType,
      })

      return {
        storageKey,
        uploadUrl: signedUpload.uploadUrl,
        expiresAt: signedUpload.expiresAt.toISOString(),
      }
    },

    async confirmOriginalAsset(
      userId: string,
      projectId: string,
      input: ConfirmOriginalAssetInput,
    ): Promise<AssetDto> {
      await findProjectForUser(userId, projectId)

      const mimeType = validateMimeType(input.mimeType)
      const byteSize = validateByteSize(input.byteSize, config.maxImageByteSize)
      const storageKey = validateOriginalStorageKey(userId, projectId, input.storageKey)

      try {
        const asset = await prisma.asset.create({
          data: {
            projectId,
            kind: AssetKind.ORIGINAL,
            storageKey,
            mimeType,
            byteSize,
            expiresAt: addDays(new Date(), config.originalAssetTtlDays),
          },
        })

        return toAssetDto(asset)
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ProjectError(409, 'Asset already confirmed')
        }

        throw error
      }
    },

    async listAssets(userId: string, projectId: string): Promise<AssetDto[]> {
      await findProjectForUser(userId, projectId)

      const assets = await prisma.asset.findMany({
        where: {
          projectId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      })

      return assets.map(toAssetDto)
    },

    async createAssetDownloadUrl(
      userId: string,
      projectId: string,
      assetId: string,
    ): Promise<SignedAssetDownloadDto> {
      const asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          projectId,
          deletedAt: null,
          project: {
            userId,
            status: { not: ProjectStatus.DELETED },
          },
        },
      })

      if (!asset) {
        throw new ProjectError(404, 'Asset not found')
      }

      const signedDownload = await storageService.createSignedDownloadUrl(asset.storageKey)

      return {
        asset: toAssetDto(asset),
        downloadUrl: signedDownload.downloadUrl,
        expiresAt: signedDownload.expiresAt.toISOString(),
      }
    },
  }
}
