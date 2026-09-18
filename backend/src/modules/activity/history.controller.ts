import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../shared/plugins/auth-guard.plugin.js'
import { taskParamsSchema } from '../tasks/task.schemas.js'
import type { TaskService } from '../tasks/task.service.js'
import type { ActivityLogEntity } from './activity-log.entity.js'
import type { IActivityRepository } from './activity.repository.js'

// T22: leitura do histórico (extra Fase 6, fonte MongoDB).
// `activity` OPCIONAL — sem mongo (degradação HIST-04) as rotas retornam [] 200.
// Escopo SEMPRE pelo userId do token: history valida o dono via findById
// escopado (cross-user → 404 TASK_NOT_FOUND) e o feed filtra por userId.
function currentUserId(request: { user?: unknown }): number {
  return (request.user as { sub: number }).sub
}

// DTO serializável: ObjectId vira string, changes ausente vira null.
function toHistoryDto(log: ActivityLogEntity): {
  id: string
  taskId: number
  userId: number
  action: ActivityLogEntity['action']
  changes: ActivityLogEntity['changes']
  occurredAt: Date
} {
  return {
    id: String(log.id),
    taskId: log.taskId,
    userId: log.userId,
    action: log.action,
    changes: log.changes ?? null,
    occurredAt: log.occurredAt,
  }
}

export function registerHistoryRoutes(
  app: FastifyInstance,
  taskService: TaskService,
  activity?: IActivityRepository,
): void {
  app.get(
    '/api/tasks/:id/history',
    { preHandler: [requireAuth], schema: { params: taskParamsSchema } },
    async (request) => {
      const { id } = request.params as { id: string }
      const taskId = Number(id)
      const userId = currentUserId(request)
      // Primeiro o dono (escopado) — cross-user/inexistente → 404 TASK_NOT_FOUND.
      await taskService.getById(userId, taskId)
      if (activity === undefined) {
        return []
      }
      const logs = await activity.findByTask(taskId, userId)
      return logs.map(toHistoryDto)
    },
  )

  app.get('/api/activity', { preHandler: [requireAuth] }, async (request) => {
    if (activity === undefined) {
      return []
    }
    const logs = await activity.findByUser(currentUserId(request))
    return logs.map(toHistoryDto)
  })
}
