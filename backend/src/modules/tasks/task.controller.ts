import type { FastifyInstance } from 'fastify'
import type { CreateTaskBody, ReorderTasksBody, UpdateTaskBody } from './task.schemas.js'
import { createTaskBodySchema, reorderTasksBodySchema, taskParamsSchema, updateTaskBodySchema } from './task.schemas.js'
import type { TaskService } from './task.service.js'

// Camada HTTP: registra rotas, valida via TypeBox, delega ao service.
// Erros (AppError ou validação) borbulham ao error-handler global.
export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get('/api/tasks', async () => service.list())

  app.get('/api/tasks/:id', { schema: { params: taskParamsSchema } }, async (request) => {
    const { id } = request.params as { id: string }
    return service.getById(Number(id))
  })

  app.post('/api/tasks', { schema: { body: createTaskBodySchema } }, async (request, reply) => {
    const task = await service.create(request.body as CreateTaskBody)
    return reply.status(201).send(task)
  })

  // R1: ANTES de /api/tasks/:id (senão "reorder" cairia no params :id).
  app.patch('/api/tasks/reorder', { schema: { body: reorderTasksBodySchema } }, async (request) => {
    const { ids } = request.body as ReorderTasksBody
    return service.reorder(ids)
  })

  app.patch(
    '/api/tasks/:id',
    { schema: { params: taskParamsSchema, body: updateTaskBodySchema } },
    async (request) => {
      const { id } = request.params as { id: string }
      return service.update(Number(id), request.body as UpdateTaskBody)
    },
  )

  app.delete('/api/tasks/:id', { schema: { params: taskParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.remove(Number(id))
    return reply.status(204).send()
  })
}
