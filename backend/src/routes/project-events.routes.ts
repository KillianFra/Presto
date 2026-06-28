import { Router, type NextFunction, type Request, type Response } from 'express'
import type { ProjectService } from '../modules/projects/project.types.js'
import type { ProjectEventDto, ProjectEventService } from '../modules/events/project-events.service.js'
import { ProjectError } from '../modules/projects/project.errors.js'

interface ProjectEventsRouterOptions {
  projectService: ProjectService
  eventService: ProjectEventService
}

function writeEvent(res: Response, event: ProjectEventDto): void {
  res.write(`id: ${event.id}\n`)
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

function readParam(req: Request, field: string): string {
  const value = req.params[field]

  if (typeof value !== 'string') {
    throw new ProjectError(400, `${field} is required`)
  }

  return value
}

function handleProjectEventError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ProjectError) {
    res.status(error.statusCode).json({ error: { message: error.message } })
    return
  }

  next(error)
}

export function createProjectEventsRouter(options: ProjectEventsRouterOptions): Router {
  const router = Router()
  const { projectService, eventService } = options

  router.get('/:projectId/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) {
        throw new ProjectError(500, 'Authenticated user is missing from request')
      }

      const projectId = readParam(req, 'projectId')
      await projectService.getProject(req.authUser.id, projectId)
      res.status(200)
      res.setHeader('content-type', 'text/event-stream')
      res.setHeader('cache-control', 'no-cache')
      res.setHeader('connection', 'keep-alive')
      res.flushHeaders?.()

      const events = await eventService.list(projectId)

      for (const event of events) {
        writeEvent(res, event)
      }

      const unsubscribe = eventService.subscribe(projectId, (event) => writeEvent(res, event))
      req.on('close', unsubscribe)
    } catch (error) {
      handleProjectEventError(error, res, next)
    }
  })

  return router
}
