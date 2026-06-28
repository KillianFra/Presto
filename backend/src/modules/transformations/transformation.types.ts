import type { ProjectStatus, ProjectVertical, TransformationStatus } from '@prisma/client'

export interface SuggestionDto {
  id: string
  projectId: string
  label: string
  generatedPrompt: string
  selected: boolean
  createdAt: string
}

export interface TransformationDto {
  id: string
  projectId: string
  suggestionId: string | null
  userPrompt: string | null
  internalPrompt: string
  status: TransformationStatus
  providerName: string | null
  providerRequestId: string | null
  costCents: number | null
  durationMs: number | null
  aiDisclosure: string | null
  errorMessage: string | null
  resultAssetId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectSnapshotDto {
  id: string
  title: string
  vertical: ProjectVertical
  status: ProjectStatus
}

export interface AnalyzeProjectResultDto {
  project: ProjectSnapshotDto
  analysis: string
  suggestions: SuggestionDto[]
}

export interface CreateTransformationInput {
  suggestionId?: string
  userPrompt?: string
}

export interface TransformationService {
  analyzeProject(userId: string, projectId: string): Promise<AnalyzeProjectResultDto>
  listSuggestions(userId: string, projectId: string): Promise<SuggestionDto[]>
  createTransformation(
    userId: string,
    projectId: string,
    input: CreateTransformationInput,
  ): Promise<TransformationDto>
  listTransformations(userId: string, projectId: string): Promise<TransformationDto[]>
}
