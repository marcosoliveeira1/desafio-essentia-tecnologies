import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../shared/plugins/auth-guard.plugin.js'
import type { CreateTaskBody, ReorderTasksBody, UpdateTaskBody } from './task.schemas.js'
import { createTaskBodySchema, reorderTasksBodySchema, taskParamsSchema, updateTaskBodySchema } from './task.schemas.js'
import type { TaskService } from './task.service.js'

// Camada HTTP: registra rotas, valida via TypeBox, delega ao service.
// T18: preHandler [requireAuth] nas 6 rotas /api/tasks*; userId sai de
// (request.user as {sub:number}).sub. Erros borbulham ao error-handler global.
// /api/auth/* e /health NÃO são tocados aqui.
function currentUserId(request: { user?: unknown }): number {
  return (request.user as { sub: number }).sub
}

export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get('/api/tasks', { preHandler: [requireAuth] }, async (request) => service.list(currentUserId(request)))

  app.get('/api/tasks/:id', { preHandler: [requireAuth], schema: { params: taskParamsSchema } }, async (request) => {
    const { id } = request.params as { id: string }
    return service.getById(currentUserId(request), Number(id))
  })

  app.post(
    '/api/tasks',
    { preHandler: [requireAuth], schema: { body: createTaskBodySchema } },
    async (request, reply) => {
      const task = await service.create(currentUserId(request), request.body as CreateTaskBody)
      return reply.status(201).send(task)
    },
  )

  // R1: ANTES de /api/tasks/:id (senão "reorder" cairia no params :id).
  app.patch(
    '/api/tasks/reorder',
    { preHandler: [requireAuth], schema: { body: reorderTasksBodySchema } },
    async (request) => {
      const { ids } = request.body as ReorderTasksBody
      return service.reorder(currentUserId(request), ids)
    },
  )

  app.patch(
    '/api/tasks/:id',
    { preHandler: [requireAuth], schema: { params: taskParamsSchema, body: updateTaskBodySchema } },
    async (request) => {
      const { id } = request.params as { id: string }
      return service.update(currentUserId(request), Number(id), request.body as UpdateTaskBody)
    },
  )

  app.delete(
    '/api/tasks/:id',
    { preHandler: [requireAuth], schema: { params: taskParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await service.remove(currentUserId(request), Number(id))
      return reply.status(204).send()
    },
  )
}
