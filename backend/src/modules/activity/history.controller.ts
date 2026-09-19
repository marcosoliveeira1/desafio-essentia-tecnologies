import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../shared/plugins/auth-guard.plugin.js'
import { taskParamsSchema } from '../tasks/task.schemas.js'
import type { TaskService } from '../tasks/task.service.js'
import type { IActivityRepository } from './activity.repository.js'
import type { ActivityLogEntity } from './activity-log.entity.js'

function currentUserId(request: { user?: unknown }): number {
	return (request.user as { sub: number }).sub
}

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
