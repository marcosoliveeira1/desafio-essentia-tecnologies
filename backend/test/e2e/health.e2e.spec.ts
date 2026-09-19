import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

describe('GET /health (e2e)', () => {
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

	it('retorna 200 com banco no ar', async () => {
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual({ status: 'ok', db: 'up' })
	})

	it('rota inexistente retorna 404 padronizado', async () => {
		const res = await app.inject({ method: 'GET', url: '/rota-que-nao-existe' })
		expect(res.statusCode).toBe(404)
		const body = res.json() as { code: string; message: string }
		expect(typeof body.code).toBe('string')
		expect(typeof body.message).toBe('string')
	})
})
