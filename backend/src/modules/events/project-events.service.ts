import { Prisma, type ProjectEventType, type PrismaClient } from '@prisma/client'

export interface ProjectEventDto {
  id: string
  projectId: string
  type: ProjectEventType
  payload: unknown
  createdAt: string
}

export interface ProjectEventService {
  publish(projectId: string, type: ProjectEventType, payload: unknown): Promise<ProjectEventDto>
  list(projectId: string, since?: Date): Promise<ProjectEventDto[]>
  subscribe(projectId: string, listener: (event: ProjectEventDto) => void): () => void
}

type Listener = (event: ProjectEventDto) => void

function toDto(event: {
  id: string
  projectId: string
  type: ProjectEventType
  payload: unknown
  createdAt: Date
}): ProjectEventDto {
  return {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  }
}

export function createProjectEventService(prisma: PrismaClient): ProjectEventService {
  const listenersByProject = new Map<string, Set<Listener>>()

  return {
    async publish(projectId: string, type: ProjectEventType, payload: unknown): Promise<ProjectEventDto> {
      const jsonPayload = JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue
      const event = toDto(await prisma.projectEvent.create({
        data: {
          projectId,
          type,
          payload: jsonPayload,
        },
      }))
      const listeners = listenersByProject.get(projectId)

      if (listeners) {
        for (const listener of listeners) {
          listener(event)
        }
      }

      return event
    },

    async list(projectId: string, since?: Date): Promise<ProjectEventDto[]> {
      const events = await prisma.projectEvent.findMany({
        where: {
          projectId,
          createdAt: since ? { gt: since } : undefined,
        },
        orderBy: { createdAt: 'asc' },
      })

      return events.map(toDto)
    },

    subscribe(projectId: string, listener: Listener): () => void {
      const listeners = listenersByProject.get(projectId) || new Set<Listener>()
      listeners.add(listener)
      listenersByProject.set(projectId, listeners)

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
          listenersByProject.delete(projectId)
        }
      }
    },
  }
}
