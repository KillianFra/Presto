import { Router, type NextFunction, type Request, type Response } from 'express'
import { CreditError } from '../modules/credits/credit.errors.js'
import type { AuthUser } from '../modules/auth/auth.types.js'
import { TransformationError } from '../modules/transformations/transformation.errors.js'
import type { TransformationService } from '../modules/transformations/transformation.types.js'

interface TransformationRouterOptions {
  transformationService: TransformationService
}

function getAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new TransformationError(500, 'Authenticated user is missing from request')
  }

  return req.authUser
}

function readBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
}

function readOptionalStringBody(req: Request, field: string): string | undefined {
  const value = readBody(req)[field]
  return typeof value === 'string' ? value : undefined
}

function handleTransformationError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof TransformationError || error instanceof CreditError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
      },
    })
    return
  }

  next(error)
}

export function createTransformationRouter(options: TransformationRouterOptions): Router {
  const router = Router()
  const { transformationService } = options

  router.post('/:projectId/analyze', async (req, res, next) => {
    try {
      const result = await transformationService.analyzeProject(getAuthUser(req).id, req.params.projectId)
      res.status(200).json(result)
    } catch (error) {
      handleTransformationError(error, res, next)
    }
  })

  router.get('/:projectId/suggestions', async (req, res, next) => {
    try {
      const suggestions = await transformationService.listSuggestions(getAuthUser(req).id, req.params.projectId)
      res.status(200).json({ suggestions })
    } catch (error) {
      handleTransformationError(error, res, next)
    }
  })

  router.post('/:projectId/transformations', async (req, res, next) => {
    try {
      const transformation = await transformationService.createTransformation(getAuthUser(req).id, req.params.projectId, {
        suggestionId: readOptionalStringBody(req, 'suggestionId'),
        userPrompt: readOptionalStringBody(req, 'userPrompt'),
      })
      res.status(201).json({ transformation })
    } catch (error) {
      handleTransformationError(error, res, next)
    }
  })

  router.get('/:projectId/transformations', async (req, res, next) => {
    try {
      const transformations = await transformationService.listTransformations(getAuthUser(req).id, req.params.projectId)
      res.status(200).json({ transformations })
    } catch (error) {
      handleTransformationError(error, res, next)
    }
  })

  return router
}
