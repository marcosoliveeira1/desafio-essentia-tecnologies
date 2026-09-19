import type { AppInstance } from '../../shared/http/app-instance.js'
import { requireAuth } from '../../shared/plugins/auth-guard.plugin.js'
import { currentUserId } from '../../shared/plugins/current-user.js'
import {
	createTaskBodySchema,
	reorderTasksBodySchema,
	taskParamsSchema,
	updateTaskBodySchema,
} from './task.schemas.js'
import type { TaskService } from './task.service.js'

export function registerTaskRoutes(
	app: AppInstance,
	service: TaskService,
): void {
	app.get('/api/tasks', { preHandler: [requireAuth] }, async (request) =>
		service.list(currentUserId(request)),
	)

	app.get(
		'/api/tasks/:id',
		{ preHandler: [requireAuth], schema: { params: taskParamsSchema } },
		async (request) => {
			const { id } = request.params
			return service.getById(currentUserId(request), Number(id))
		},
	)

	app.post(
		'/api/tasks',
		{ preHandler: [requireAuth], schema: { body: createTaskBodySchema } },
		async (request, reply) => {
			const task = await service.create(currentUserId(request), request.body)
			return reply.status(201).send(task)
		},
	)

	app.patch(
		'/api/tasks/reorder',
		{ preHandler: [requireAuth], schema: { body: reorderTasksBodySchema } },
		async (request) => {
			const { ids } = request.body
			return service.reorder(currentUserId(request), ids)
		},
	)

	app.patch(
		'/api/tasks/:id',
		{
			preHandler: [requireAuth],
			schema: { params: taskParamsSchema, body: updateTaskBodySchema },
		},
		async (request) => {
			const { id } = request.params
			return service.update(currentUserId(request), Number(id), request.body)
		},
	)

	app.delete(
		'/api/tasks/:id',
		{ preHandler: [requireAuth], schema: { params: taskParamsSchema } },
		async (request, reply) => {
			const { id } = request.params
			await service.remove(currentUserId(request), Number(id))
			return reply.status(204).send()
		},
	)
}
