import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { env } from '../env.js'
import { ActivityLogEntity } from '../modules/activity/activity-log.entity.js'

export function createMongoDataSource(url?: string): DataSource {
	const mongoUrl = url ?? env.mongo.url
	const database = new URL(mongoUrl).pathname.replace(/^\//, '') || undefined
	return new DataSource({
		type: 'mongodb',
		url: mongoUrl,
		...(database !== undefined ? { database } : {}),
		entities: [ActivityLogEntity],
		synchronize: false,
		logging: false,
	})
}

export async function ensureActivityIndexes(mongo: DataSource): Promise<void> {
	const manager = mongo.mongoManager
	await manager.createCollectionIndex(
		ActivityLogEntity,
		{ taskId: 1, userId: 1, occurredAt: -1 },
		{ name: 'idx_task_activity_task_user_occurred' },
	)
	await manager.createCollectionIndex(
		ActivityLogEntity,
		{ userId: 1, occurredAt: -1 },
		{ name: 'idx_task_activity_user_occurred' },
	)
}

export const mongoDataSource = createMongoDataSource()
