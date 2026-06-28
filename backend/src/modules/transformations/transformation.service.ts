import {
  AssetKind,
  ProjectEventType,
  ProjectStatus,
  TransformationStatus,
  type PrismaClient,
} from '@prisma/client'
import type { AppConfig } from '../../config/env.js'
import type { AiProvider } from '../ai/ai.types.js'
import { CreditError } from '../credits/credit.errors.js'
import type { CreditService } from '../credits/credit.types.js'
import type { ProjectEventService } from '../events/project-events.service.js'
import { TransformationError } from './transformation.errors.js'
import type {
  AnalyzeProjectResultDto,
  CreateTransformationInput,
  ProjectSnapshotDto,
  SuggestionDto,
  TransformationDto,
  TransformationService,
} from './transformation.types.js'

interface ProjectWithOriginal {
  id: string
  userId: string
  title: string
  vertical: ProjectSnapshotDto['vertical']
  status: ProjectSnapshotDto['status']
  assets: Array<{
    id: string
    storageKey: string
    mimeType: string
  }>
}

function toProjectSnapshot(project: {
  id: string
  title: string
  vertical: ProjectSnapshotDto['vertical']
  status: ProjectSnapshotDto['status']
}): ProjectSnapshotDto {
  return {
    id: project.id,
    title: project.title,
    vertical: project.vertical,
    status: project.status,
  }
}

function toSuggestionDto(suggestion: {
  id: string
  projectId: string
  label: string
  generatedPrompt: string
  selected: boolean
  createdAt: Date
}): SuggestionDto {
  return {
    id: suggestion.id,
    projectId: suggestion.projectId,
    label: suggestion.label,
    generatedPrompt: suggestion.generatedPrompt,
    selected: suggestion.selected,
    createdAt: suggestion.createdAt.toISOString(),
  }
}

function toTransformationDto(transformation: {
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
  resultAsset?: { id: string } | null
  createdAt: Date
  updatedAt: Date
}): TransformationDto {
  return {
    id: transformation.id,
    projectId: transformation.projectId,
    suggestionId: transformation.suggestionId,
    userPrompt: transformation.userPrompt,
    internalPrompt: transformation.internalPrompt,
    status: transformation.status,
    providerName: transformation.providerName,
    providerRequestId: transformation.providerRequestId,
    costCents: transformation.costCents,
    durationMs: transformation.durationMs,
    aiDisclosure: transformation.aiDisclosure,
    errorMessage: transformation.errorMessage,
    resultAssetId: transformation.resultAsset?.id || null,
    createdAt: transformation.createdAt.toISOString(),
    updatedAt: transformation.updatedAt.toISOString(),
  }
}

function normalizePrompt(prompt: string | undefined): string | undefined {
  const normalizedPrompt = prompt?.trim()

  return normalizedPrompt || undefined
}

function buildInternalPrompt(project: ProjectSnapshotDto, suggestionPrompt?: string, userPrompt?: string): string {
  const basePrompt = suggestionPrompt || userPrompt

  if (!basePrompt) {
    throw new TransformationError(400, 'A suggestionId or userPrompt is required')
  }

  const disclosure = project.vertical === 'IMMOBILIER'
    ? 'Conserver un rendu realiste et compatible avec la mention simulation IA.'
    : 'Conserver un rendu realiste et fidele a l objet.'

  return `${basePrompt}\n${disclosure}`
}

function aiDisclosureFor(project: ProjectSnapshotDto): string | null {
  return project.vertical === 'IMMOBILIER' ? 'Simulation IA - visuel transforme automatiquement' : null
}

export function createTransformationService(
  prisma: PrismaClient,
  aiProvider: AiProvider,
  creditService: CreditService,
  eventService: ProjectEventService,
  config: Readonly<AppConfig>,
): TransformationService {
  async function getProjectForUser(userId: string, projectId: string): Promise<ProjectWithOriginal> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
        status: { not: ProjectStatus.DELETED },
      },
      include: {
        assets: {
          where: {
            kind: AssetKind.ORIGINAL,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
          },
        },
      },
    })

    if (!project) {
      throw new TransformationError(404, 'Project not found')
    }

    return project
  }

  async function getSuggestionForProject(projectId: string, suggestionId: string | undefined) {
    if (!suggestionId) return null

    const suggestion = await prisma.suggestion.findFirst({
      where: {
        id: suggestionId,
        projectId,
      },
    })

    if (!suggestion) {
      throw new TransformationError(404, 'Suggestion not found')
    }

    return suggestion
  }

  return {
    async analyzeProject(userId: string, projectId: string): Promise<AnalyzeProjectResultDto> {
      const project = await getProjectForUser(userId, projectId)
      const originalAsset = project.assets[0]

      if (!originalAsset) {
        throw new TransformationError(409, 'Project needs an original asset before analysis')
      }

      await prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ANALYZING },
      })

      const analysisResult = await aiProvider.analyzeImage({
        project: toProjectSnapshot(project),
        originalAsset,
      })

      await prisma.suggestion.deleteMany({ where: { projectId } })

      const suggestions = await Promise.all(
        analysisResult.suggestions.map((suggestion) => prisma.suggestion.create({
          data: {
            projectId,
            label: suggestion.label,
            generatedPrompt: suggestion.generatedPrompt,
          },
        })),
      )

      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.SUGGESTIONS_READY },
      })

      await eventService.publish(projectId, ProjectEventType.SUGGESTIONS_READY, {
        projectId,
        suggestionCount: suggestions.length,
      })

      return {
        project: toProjectSnapshot(updatedProject),
        analysis: analysisResult.analysis,
        suggestions: suggestions.map(toSuggestionDto),
      }
    },

    async listSuggestions(userId: string, projectId: string): Promise<SuggestionDto[]> {
      await getProjectForUser(userId, projectId)

      const suggestions = await prisma.suggestion.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      })

      return suggestions.map(toSuggestionDto)
    },

    async createTransformation(
      userId: string,
      projectId: string,
      input: CreateTransformationInput,
    ): Promise<TransformationDto> {
      const project = toProjectSnapshot(await getProjectForUser(userId, projectId))
      const userPrompt = normalizePrompt(input.userPrompt)
      const suggestion = await getSuggestionForProject(projectId, input.suggestionId)
      const internalPrompt = buildInternalPrompt(project, suggestion?.generatedPrompt, userPrompt)
      const ledger = await creditService.getLedger(userId)

      if (ledger.wallet.balance < config.transformationCreditCost) {
        throw new CreditError(402, 'Insufficient credits')
      }

      const transformation = await prisma.transformation.create({
        data: {
          projectId,
          suggestionId: suggestion?.id,
          userPrompt,
          internalPrompt,
          status: TransformationStatus.PROCESSING,
          aiDisclosure: aiDisclosureFor(project),
        },
      })

      await prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.PROCESSING },
      })

      try {
        const generated = await aiProvider.generateImage({
          project,
          transformationId: transformation.id,
          suggestionPrompt: suggestion?.generatedPrompt,
          userPrompt,
          internalPrompt,
        })

        const updatedTransformation = await prisma.$transaction(async (tx) => {
          const result = await tx.transformation.update({
            where: { id: transformation.id },
            data: {
              status: TransformationStatus.SUCCEEDED,
              llmAnalysis: generated.llmAnalysis,
              providerName: generated.providerName,
              providerRequestId: generated.providerRequestId,
              costCents: generated.costCents,
              durationMs: generated.durationMs,
              resultAsset: {
                create: {
                  projectId,
                  kind: AssetKind.GENERATED,
                  storageKey: generated.storageKey,
                  mimeType: generated.mimeType,
                  byteSize: generated.byteSize,
                },
              },
            },
            include: { resultAsset: { select: { id: true } } },
          })

          await tx.project.update({
            where: { id: projectId },
            data: { status: ProjectStatus.DONE },
          })

          if (suggestion) {
            await tx.suggestion.update({
              where: { id: suggestion.id },
              data: { selected: true },
            })
          }

          return result
        })

        await creditService.consumeCredits(
          userId,
          config.transformationCreditCost,
          'Image transformation',
          transformation.id,
        )
        await eventService.publish(projectId, ProjectEventType.TRANSFORMATION_UPDATED, {
          projectId,
          transformationId: transformation.id,
          status: TransformationStatus.SUCCEEDED,
        })

        return toTransformationDto(updatedTransformation)
      } catch (error) {
        if (error instanceof TransformationError) {
          throw error
        }

        await prisma.transformation.update({
          where: { id: transformation.id },
          data: {
            status: TransformationStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Transformation failed',
          },
        })
        await prisma.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.ERROR },
        })

        throw error
      }
    },

    async listTransformations(userId: string, projectId: string): Promise<TransformationDto[]> {
      await getProjectForUser(userId, projectId)

      const transformations = await prisma.transformation.findMany({
        where: { projectId },
        include: { resultAsset: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
      })

      return transformations.map(toTransformationDto)
    },
  }
}
