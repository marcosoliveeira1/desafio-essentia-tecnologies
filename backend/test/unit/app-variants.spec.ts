import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthService } from '../../src/modules/auth/auth.service.js'
import type { TaskService } from '../../src/modules/tasks/task.service.js'

const APPS: FastifyInstance[] = []

afterEach(async () => {
	for (const app of APPS.splice(0)) {
		await app.close()
	}
	vi.resetModules()
})

function fakeDb(): DataSource {
	return {
		query: async () => [],
		getRepository: () => ({}),
	} as unknown as DataSource
}

function stubServices(): {
	taskService: TaskService
	authService: AuthService
} {
	return {
		taskService: {
			list: async () => [],
			getById: async (userId: number, id: number) => ({ id, userId }),
			create: async () => ({}),
			reorder: async () => [],
			update: async () => ({}),
			remove: async () => true,
		} as unknown as TaskService,
		authService: {
			register: async () => ({}),
			login: async () => ({ token: 't' }),
		} as unknown as AuthService,
	}
}

async function freshBuildApp(env: Record<string, string | undefined>) {
	const snapshot = { ...process.env }
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			delete process.env[key]
		} else {
			process.env[key] = value
		}
	}
	try {
		const { buildApp } = await import('../../src/app.js')
		return await buildApp({ db: fakeDb(), ...stubServices() })
	} finally {
		process.env = { ...snapshot }
	}
}

describe('buildApp variants (unit, ramos de env)', () => {
	it('default de teste: CORS aberto + swagger ligado + jwtSecret explícito', async () => {
		const app = await freshBuildApp({
			NODE_ENV: 'test',
			JWT_SECRET: 'variant-default-secret-min-32-chars!!!',
			CORS_ORIGINS: undefined,
			SWAGGER_ENABLED: undefined,
		})
		APPS.push(app)
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		const docs = await app.inject({ method: 'GET', url: '/api/docs/json' })
		expect(docs.statusCode).toBe(200)
	})

	it('CORS_ORIGINS explícito registra allowlist', async () => {
		const app = await freshBuildApp({
			NODE_ENV: 'test',
			JWT_SECRET: 'variant-cors-secret-min-32-chars!!!!!!',
			CORS_ORIGINS: 'https://a.com, https://b.com',
			SWAGGER_ENABLED: 'false',
		})
		APPS.push(app)
		const res = await app.inject({
			method: 'GET',
			url: '/health',
			headers: { origin: 'https://a.com' },
		})
		expect(res.statusCode).toBe(200)
		expect(res.headers['access-control-allow-origin']).toBe('https://a.com')
	})

	it('production sem CORS_ORIGINS nem swagger: sem plugin, sem docs', async () => {
		const app = await freshBuildApp({
			NODE_ENV: 'production',
			JWT_SECRET: 'variant-prod-secret-min-32-chars!!!!!',
			CORS_ORIGINS: undefined,
			SWAGGER_ENABLED: undefined,
		})
		APPS.push(app)
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		expect(res.headers['access-control-allow-origin']).toBeUndefined()
		const docs = await app.inject({ method: 'GET', url: '/api/docs/json' })
		expect(docs.statusCode).toBe(404)
	})

	it('SWAGGER_ENABLED=true força docs mesmo em production', async () => {
		const app = await freshBuildApp({
			NODE_ENV: 'production',
			JWT_SECRET: 'variant-swagger-secret-min-32-chars!!',
			CORS_ORIGINS: 'https://a.com',
			SWAGGER_ENABLED: 'true',
		})
		APPS.push(app)
		const docs = await app.inject({ method: 'GET', url: '/api/docs/json' })
		expect(docs.statusCode).toBe(200)
	})

	it('sem overrides: monta services reais sobre o DataSource', async () => {
		const snapshot = { ...process.env }
		process.env.NODE_ENV = 'test'
		process.env.JWT_SECRET = 'variant-nooverride-secret-min-32-ch!'
		delete process.env.CORS_ORIGINS
		process.env.SWAGGER_ENABLED = 'false'
		try {
			const { buildApp } = await import('../../src/app.js')
			const app = await buildApp({ db: fakeDb() })
			APPS.push(app)
			const res = await app.inject({ method: 'GET', url: '/health' })
			expect(res.statusCode).toBe(200)
		} finally {
			process.env = { ...snapshot }
		}
	})

	it('override só de authService: taskService real é criado', async () => {
		const snapshot = { ...process.env }
		process.env.NODE_ENV = 'test'
		process.env.JWT_SECRET = 'variant-authonly-secret-min-32-chars!'
		delete process.env.CORS_ORIGINS
		process.env.SWAGGER_ENABLED = 'false'
		try {
			const { buildApp } = await import('../../src/app.js')
			const app = await buildApp({
				db: fakeDb(),
				authService: stubServices().authService,
			})
			APPS.push(app)
			const res = await app.inject({ method: 'GET', url: '/health' })
			expect(res.statusCode).toBe(200)
		} finally {
			process.env = { ...snapshot }
		}
	})
})
