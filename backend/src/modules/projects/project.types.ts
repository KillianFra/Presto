import type { AssetKind, ProjectStatus, ProjectVertical } from '@prisma/client'

export interface ProjectDto {
  id: string
  userId: string
  title: string
  vertical: ProjectVertical
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface AssetDto {
  id: string
  projectId: string
  kind: AssetKind
  storageKey: string
  mimeType: string
  byteSize: number | null
  expiresAt: string | null
  deletedAt: string | null
  createdAt: string
}

export interface ProjectDetailsDto extends ProjectDto {
  assets: AssetDto[]
}

export interface CreateProjectInput {
  title: string
  vertical: string
}

export interface UpdateProjectInput {
  title?: string
  vertical?: string
}

export interface CreateOriginalUploadInput {
  fileName: string
  mimeType: string
  byteSize: number
}

export interface ConfirmOriginalAssetInput {
  storageKey: string
  mimeType: string
  byteSize: number
}

export interface SignedOriginalUploadDto {
  storageKey: string
  uploadUrl: string
  expiresAt: string
}

export interface SignedAssetDownloadDto {
  asset: AssetDto
  downloadUrl: string
  expiresAt: string
}

export interface ProjectService {
  listProjects(userId: string): Promise<ProjectDto[]>
  createProject(userId: string, input: CreateProjectInput): Promise<ProjectDto>
  getProject(userId: string, projectId: string): Promise<ProjectDetailsDto>
  updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto>
  deleteProject(userId: string, projectId: string): Promise<void>
  createOriginalUploadUrl(
    userId: string,
    projectId: string,
    input: CreateOriginalUploadInput,
  ): Promise<SignedOriginalUploadDto>
  confirmOriginalAsset(
    userId: string,
    projectId: string,
    input: ConfirmOriginalAssetInput,
  ): Promise<AssetDto>
  listAssets(userId: string, projectId: string): Promise<AssetDto[]>
  createAssetDownloadUrl(userId: string, projectId: string, assetId: string): Promise<SignedAssetDownloadDto>
}
