import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
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

	it('/health tem CSP ativa (default-src self)', async () => {
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		const csp = res.headers['content-security-policy']
		expect(csp).toBeDefined()
		expect(String(csp)).toContain("default-src 'self'")
	})

	it('/api/docs NÃO tem CSP (isenção da superfície de docs)', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/docs' })
		expect(res.statusCode).toBe(200)
		expect(res.headers['content-type']).toContain('text/html')
		expect(res.headers['content-security-policy']).toBeUndefined()
	})

	it('/api/docs/json NÃO tem CSP', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/docs/json' })
		expect(res.statusCode).toBe(200)
		expect(res.headers['content-security-policy']).toBeUndefined()
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

describe('docs /api/docs em production (e2e)', () => {
	const PROD_TEST_SECRET = 'prod-e2e-secret-min-32-chars-123456'
	let savedEnv: Record<string, string | undefined>
	let app: FastifyInstance | undefined
	let db: DataSource | undefined

	const startProdApp = async (): Promise<FastifyInstance> => {
		vi.resetModules()
		const [{ env: freshEnv }, { buildApp: freshBuildApp }] = await Promise.all([
			import('../../src/env.js'),
			import('../../src/app.js'),
		])
		db = createMysqlDataSource(freshEnv.dbTest)
		await db.initialize()
		const prodApp = await freshBuildApp({ db })
		app = prodApp
		return prodApp
	}

	const setProdEnv = () => {
		process.env.NODE_ENV = 'production'
		process.env.JWT_SECRET = PROD_TEST_SECRET
		delete process.env.SWAGGER_ENABLED
		delete process.env.CORS_ORIGINS
	}

	beforeAll(() => {
		savedEnv = { ...process.env }
	})

	afterEach(async () => {
		if (app !== undefined) {
			await app.close()
			app = undefined
		}
		if (db !== undefined) {
			if (db.isInitialized) {
				await db.destroy()
			}
			db = undefined
		}
	})

	afterAll(() => {
		process.env = { ...savedEnv }
		vi.resetModules()
	})

	it('SWAGGER_ENABLED unset → /api/docs 404 e /health com CSP', async () => {
		setProdEnv()
		const app = await startProdApp()

		const docs = await app.inject({ method: 'GET', url: '/api/docs' })
		expect(docs.statusCode).toBe(404)
		expect(docs.json()).toMatchObject({ code: 'NOT_FOUND' })

		const health = await app.inject({ method: 'GET', url: '/health' })
		expect(health.statusCode).toBe(200)
		const csp = health.headers['content-security-policy']
		expect(csp).toBeDefined()
		expect(String(csp)).toContain("default-src 'self'")
	})

	it('SWAGGER_ENABLED=true → /api/docs 200 html sem CSP', async () => {
		setProdEnv()
		process.env.SWAGGER_ENABLED = 'true'
		const app = await startProdApp()

		const docs = await app.inject({ method: 'GET', url: '/api/docs' })
		expect(docs.statusCode).toBe(200)
		expect(docs.headers['content-type']).toContain('text/html')
		expect(docs.headers['content-security-policy']).toBeUndefined()
	})

	it('CORS unset em production → sem ACAO (plugin não registrado)', async () => {
		setProdEnv()
		const app = await startProdApp()

		const res = await app.inject({
			method: 'GET',
			url: '/health',
			headers: { origin: 'http://x.com' },
		})
		expect(res.statusCode).toBe(200)
		expect(res.headers['access-control-allow-origin']).toBeUndefined()
	})

	it('CORS_ORIGINS allowlist → origem permitida refletida, outra não', async () => {
		setProdEnv()
		process.env.CORS_ORIGINS = 'http://a.com'
		const app = await startProdApp()

		const allowed = await app.inject({
			method: 'GET',
			url: '/health',
			headers: { origin: 'http://a.com' },
		})
		expect(allowed.statusCode).toBe(200)
		expect(allowed.headers['access-control-allow-origin']).toBe('http://a.com')

		const evil = await app.inject({
			method: 'GET',
			url: '/health',
			headers: { origin: 'http://evil.com' },
		})
		expect(evil.statusCode).toBe(200)
		expect(evil.headers['access-control-allow-origin']).toBeUndefined()
	})
})
