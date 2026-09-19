import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
	createMongoDataSource,
	ensureActivityIndexes,
} from '../../src/database/mongo.data-source.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'
import { ActivityLogEntity } from '../../src/modules/activity/activity-log.entity.js'

const MONGO_TEST_URL = env.mongo.testUrl ?? env.mongo.url

interface IndexRow {
	Key_name: string
	Seq_in_index: number
	Column_name: string
}

interface MongoIndexInfo {
	name: string
	key: Record<string, number>
}

describe('indexes de banco (e2e)', () => {
	let db: DataSource
	let mongo: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		mongo = createMongoDataSource(MONGO_TEST_URL)
		await mongo.initialize()
	})

	afterAll(async () => {
		if (db.isInitialized) {
			await db.destroy()
		}
		if (mongo.isInitialized) {
			await mongo.destroy()
		}
	})

	it('tasks tem idx_tasks_user_position (userId, position, id)', async () => {
		const rows = (await db.query('SHOW INDEX FROM tasks')) as IndexRow[]
		const indexRows = rows
			.filter((row) => row.Key_name === 'idx_tasks_user_position')
			.sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
		expect(indexRows.map((row) => row.Column_name)).toEqual([
			'userId',
			'position',
			'id',
		])
	})

	it('task_activity tem os 2 indexes e criação é idempotente', async () => {
		await ensureActivityIndexes(mongo)
		await expect(ensureActivityIndexes(mongo)).resolves.toBeUndefined()

		const indexes = (await mongo.mongoManager.collectionIndexes(
			ActivityLogEntity,
		)) as unknown as MongoIndexInfo[]
		const byTask = indexes.find(
			(index) => index.name === 'idx_task_activity_task_user_occurred',
		)
		const byUser = indexes.find(
			(index) => index.name === 'idx_task_activity_user_occurred',
		)
		expect(byTask).toBeDefined()
		expect(byUser).toBeDefined()
		expect(byTask?.key).toEqual({ taskId: 1, userId: 1, occurredAt: -1 })
		expect(byUser?.key).toEqual({ userId: 1, occurredAt: -1 })
	})
})
