import { Router, type NextFunction, type Request, type Response } from 'express'
import { ProjectError } from '../modules/projects/project.errors.js'
import type { ProjectService } from '../modules/projects/project.types.js'
import { StorageError } from '../modules/storage/storage.errors.js'
import type { AuthUser } from '../modules/auth/auth.types.js'

interface ProjectRouterOptions {
  projectService: ProjectService
}

function readBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
}

function readStringBody(req: Request, field: string): string {
  const value = readBody(req)[field]
  return typeof value === 'string' ? value : ''
}

function readOptionalStringBody(req: Request, field: string): string | undefined {
  const value = readBody(req)[field]
  return typeof value === 'string' ? value : undefined
}

function readNumberBody(req: Request, field: string): number {
  const value = readBody(req)[field]
  return typeof value === 'number' ? value : Number.NaN
}

function getAuthUser(req: Request): AuthUser {
  if (!req.authUser) {
    throw new ProjectError(500, 'Authenticated user is missing from request')
  }

  return req.authUser
}

function handleProjectError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ProjectError || error instanceof StorageError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
      },
    })
    return
  }

  next(error)
}

export function createProjectRouter(options: ProjectRouterOptions): Router {
  const router = Router()
  const { projectService } = options

  router.get('/', async (req, res, next) => {
    try {
      const projects = await projectService.listProjects(getAuthUser(req).id)
      res.status(200).json({ projects })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const project = await projectService.createProject(getAuthUser(req).id, {
        title: readStringBody(req, 'title'),
        vertical: readStringBody(req, 'vertical'),
      })
      res.status(201).json({ project })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.get('/:projectId', async (req, res, next) => {
    try {
      const project = await projectService.getProject(getAuthUser(req).id, req.params.projectId)
      res.status(200).json({ project })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.patch('/:projectId', async (req, res, next) => {
    try {
      const project = await projectService.updateProject(getAuthUser(req).id, req.params.projectId, {
        title: readOptionalStringBody(req, 'title'),
        vertical: readOptionalStringBody(req, 'vertical'),
      })
      res.status(200).json({ project })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.delete('/:projectId', async (req, res, next) => {
    try {
      await projectService.deleteProject(getAuthUser(req).id, req.params.projectId)
      res.status(204).send()
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.get('/:projectId/assets', async (req, res, next) => {
    try {
      const assets = await projectService.listAssets(getAuthUser(req).id, req.params.projectId)
      res.status(200).json({ assets })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.post('/:projectId/assets/original/upload-url', async (req, res, next) => {
    try {
      const upload = await projectService.createOriginalUploadUrl(getAuthUser(req).id, req.params.projectId, {
        fileName: readStringBody(req, 'fileName'),
        mimeType: readStringBody(req, 'mimeType'),
        byteSize: readNumberBody(req, 'byteSize'),
      })
      res.status(201).json({ upload })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.post('/:projectId/assets/original', async (req, res, next) => {
    try {
      const asset = await projectService.confirmOriginalAsset(getAuthUser(req).id, req.params.projectId, {
        storageKey: readStringBody(req, 'storageKey'),
        mimeType: readStringBody(req, 'mimeType'),
        byteSize: readNumberBody(req, 'byteSize'),
      })
      res.status(201).json({ asset })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  router.get('/:projectId/assets/:assetId/download-url', async (req, res, next) => {
    try {
      const download = await projectService.createAssetDownloadUrl(
        getAuthUser(req).id,
        req.params.projectId,
        req.params.assetId,
      )
      res.status(200).json({ download })
    } catch (error) {
      handleProjectError(error, res, next)
    }
  })

  return router
}
