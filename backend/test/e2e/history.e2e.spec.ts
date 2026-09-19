import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMongoDataSource } from '../../src/database/mongo.data-source.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'
import type { IActivityRepository } from '../../src/modules/activity/activity.repository.js'
import { ActivityLogEntity } from '../../src/modules/activity/activity-log.entity.js'
import { MongoActivityRepository } from '../../src/modules/activity/mongo-activity.repository.js'

const TEST_JWT_SECRET = 'e2e-test-secret-min-32-chars-123456'
const MONGO_TEST_URL = env.mongo.testUrl ?? env.mongo.url

let userSeq = 0
async function authHeaders(
	app: FastifyInstance,
): Promise<Record<string, string>> {
	userSeq += 1
	const email = `hist${Date.now()}_${userSeq}@essentia.com`
	const password = 'segredo12'
	const registered = await app.inject({
		method: 'POST',
		url: '/api/auth/register',
		payload: { name: 'E2E', email, password },
	})
	expect(registered.statusCode).toBe(201)
	const logged = await app.inject({
		method: 'POST',
		url: '/api/auth/login',
		payload: { email, password },
	})
	expect(logged.statusCode).toBe(200)
	const { token } = logged.json() as { token: string }
	return { authorization: `Bearer ${token}` }
}

async function truncate(db: DataSource, mongo: DataSource): Promise<void> {
	await db.query('DELETE FROM tasks')
	await db.query('DELETE FROM users')
	await mongo.getMongoRepository(ActivityLogEntity).deleteMany({})
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms))

describe('task history (e2e)', () => {
	let app: FastifyInstance
	let db: DataSource
	let mongo: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		mongo = createMongoDataSource(MONGO_TEST_URL)
		await mongo.initialize()
		app = await buildApp({
			db,
			jwtSecret: TEST_JWT_SECRET,
			activityRepository: new MongoActivityRepository(mongo),
		})
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
		if (mongo.isInitialized) {
			await mongo.destroy()
		}
	})

	beforeEach(async () => {
		await truncate(db, mongo)
	})

	it('criar→editar→concluir = [completed, updated, created] desc', async () => {
		const headers = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'com-histórico' },
		})
		expect(created.statusCode).toBe(201)
		const task = created.json() as { id: number }
		await sleep(15)

		const patched = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${task.id}`,
			headers,
			payload: { title: 'com-histórico v2' },
		})
		expect(patched.statusCode).toBe(200)
		await sleep(15)

		const toggled = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${task.id}`,
			headers,
			payload: { completed: true },
		})
		expect(toggled.statusCode).toBe(200)

		const history = await app.inject({
			method: 'GET',
			url: `/api/tasks/${task.id}/history`,
			headers,
		})
		expect(history.statusCode).toBe(200)
		const events = history.json() as Array<{
			id: string
			taskId: number
			userId: number
			action: string
			changes: unknown
			occurredAt: string
		}>
		expect(events.map((e) => e.action)).toEqual([
			'completed',
			'updated',
			'created',
		])
		for (const event of events) {
			expect(typeof event.id).toBe('string')
			expect(event.taskId).toBe(task.id)
			expect(typeof event.userId).toBe('number')
			expect(typeof event.occurredAt).toBe('string')
		}

		const feed = await app.inject({
			method: 'GET',
			url: '/api/activity',
			headers,
		})
		expect(feed.statusCode).toBe(200)
		expect(
			(feed.json() as Array<{ action: string }>).map((e) => e.action),
		).toEqual(['completed', 'updated', 'created'])
	})

	it('401 sem token nas 2 rotas', async () => {
		const history = await app.inject({
			method: 'GET',
			url: '/api/tasks/1/history',
		})
		expect(history.statusCode).toBe(401)
		expect(history.json()).toMatchObject({ code: 'UNAUTHORIZED' })
		const feed = await app.inject({ method: 'GET', url: '/api/activity' })
		expect(feed.statusCode).toBe(401)
		expect(feed.json()).toMatchObject({ code: 'UNAUTHORIZED' })
	})

	it('cross-user: history 404 + /activity vazio', async () => {
		const headersA = await authHeaders(app)
		const headersB = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: headersA,
			payload: { title: 'de-A' },
		})
		expect(created.statusCode).toBe(201)
		const id = (created.json() as { id: number }).id

		const history = await app.inject({
			method: 'GET',
			url: `/api/tasks/${id}/history`,
			headers: headersB,
		})
		expect(history.statusCode).toBe(404)
		expect(history.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })

		const feed = await app.inject({
			method: 'GET',
			url: '/api/activity',
			headers: headersB,
		})
		expect(feed.statusCode).toBe(200)
		expect(feed.json()).toEqual([])

		const own = await app.inject({
			method: 'GET',
			url: `/api/tasks/${id}/history`,
			headers: headersA,
		})
		expect(own.statusCode).toBe(200)
		expect(
			(own.json() as Array<{ action: string }>).map((e) => e.action),
		).toEqual(['created'])
	})

	it('degradação: activity lança → CRUD segue (HIST-04)', async () => {
		const throwing: IActivityRepository = {
			record: async (): Promise<never> => {
				throw new Error('mongo fora (simulado)')
			},
			findByTask: async () => [],
			findByUser: async () => [],
		}
		const degradedApp = await buildApp({
			db,
			jwtSecret: TEST_JWT_SECRET,
			activityRepository: throwing,
		})
		try {
			const headers = await authHeaders(degradedApp)
			const created = await degradedApp.inject({
				method: 'POST',
				url: '/api/tasks',
				headers,
				payload: { title: 'sem-mongo' },
			})
			expect(created.statusCode).toBe(201)
			const id = (created.json() as { id: number }).id

			const patched = await degradedApp.inject({
				method: 'PATCH',
				url: `/api/tasks/${id}`,
				headers,
				payload: { title: 'sem-mongo v2' },
			})
			expect(patched.statusCode).toBe(200)

			const listed = await degradedApp.inject({
				method: 'GET',
				url: '/api/tasks',
				headers,
			})
			expect(listed.statusCode).toBe(200)
			expect(
				(listed.json() as Array<{ title: string }>).map((t) => t.title),
			).toEqual(['sem-mongo v2'])

			const deleted = await degradedApp.inject({
				method: 'DELETE',
				url: `/api/tasks/${id}`,
				headers,
			})
			expect(deleted.statusCode).toBe(204)
		} finally {
			await degradedApp.close()
		}
	})
})
