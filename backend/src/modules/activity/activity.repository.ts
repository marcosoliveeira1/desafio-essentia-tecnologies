import type {
	ActivityAction,
	ActivityLogEntity,
} from './activity-log.entity.js'

export interface RecordActivityInput {
	taskId: number
	userId: number
	action: ActivityAction
	changes?: Record<string, { from: unknown; to: unknown }> | null
}

export interface IActivityRepository {
	record(input: RecordActivityInput): Promise<ActivityLogEntity>
	findByTask(taskId: number, userId: number): Promise<ActivityLogEntity[]>
	findByUser(userId: number): Promise<ActivityLogEntity[]>
}
