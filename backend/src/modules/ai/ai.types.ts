import type { ProjectVertical } from '@prisma/client'

export interface AiProjectInput {
  id: string
  title: string
  vertical: ProjectVertical
}

export interface AiAssetInput {
  id: string
  storageKey: string
  mimeType: string
}

export interface AnalyzeImageInput {
  project: AiProjectInput
  originalAsset: AiAssetInput
}

export interface AnalyzeImageResult {
  analysis: string
  suggestions: Array<{
    label: string
    generatedPrompt: string
  }>
}

export interface GenerateImageInput {
  project: AiProjectInput
  transformationId: string
  suggestionPrompt?: string
  userPrompt?: string
  internalPrompt: string
}

export interface GenerateImageResult {
  storageKey: string
  mimeType: string
  byteSize: number
  providerName: string
  providerRequestId: string
  costCents: number
  durationMs: number
  llmAnalysis: string
}

export interface AiProvider {
  analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageResult>
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>
}
