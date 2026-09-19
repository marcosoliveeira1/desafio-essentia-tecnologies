import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

describe('docs /api/docs (e2e)', () => {
	let app: FastifyInstance
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		app = await buildApp({ db })
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	it('/api/docs/json retorna 200 com OpenAPI 3.x e todos os paths', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/docs/json' })
		expect(res.statusCode).toBe(200)
		const body = res.json() as {
			openapi: string
			info: { title: string; version: string }
			paths: Record<string, unknown>
		}
		expect(body.openapi).toMatch(/^3\./)
		expect(body.info.title).toContain('Essentia')
		expect(body.info.version).toBe('0.1.0')
		for (const path of [
			'/api/auth/register',
			'/api/auth/login',
			'/api/tasks',
			'/api/tasks/{id}',
			'/api/tasks/reorder',
			'/api/tasks/{id}/history',
			'/api/activity',
			'/health',
		]) {
			expect(body.paths).toHaveProperty(path)
		}
	})

	it('/api/docs serve a UI em html', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/docs' })
		expect(res.statusCode).toBe(200)
		expect(res.headers['content-type']).toContain('text/html')
	})

	it('/api/docs/ui-origin não requer auth (404 padrão, não 401)', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/docs/inexistente',
		})
		expect(res.statusCode).toBe(404)
		expect(res.json()).toMatchObject({ code: 'NOT_FOUND' })
	})
})
