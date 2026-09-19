import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { buildApp as buildAppType } from '../../src/app.js'
import type { AuthService } from '../../src/modules/auth/auth.service.js'
import type { TaskService } from '../../src/modules/tasks/task.service.js'
import type { ConflictError as ConflictErrorType } from '../../src/shared/errors/conflict.error.js'
import type { NotFoundError as NotFoundErrorType } from '../../src/shared/errors/not-found.error.js'

let buildApp: typeof buildAppType
let ConflictError: typeof ConflictErrorType
let NotFoundError: typeof NotFoundErrorType

const JWT_SECRET = 'http-coverage-spec-secret-min-32-chars!!'

function fakeDb(
	queryImpl: () => Promise<unknown[]> = async () => [],
): DataSource {
	return { query: queryImpl } as unknown as DataSource
}

function stubTaskService(overrides: Record<string, unknown> = {}): TaskService {
	return {
		list: async () => [],
		getById: async (userId: number, id: number) => ({
			id,
			userId,
			title: 'Tarefa',
			description: null,
			completed: false,
			position: 0,
		}),
		create: async (userId: number, body: unknown) => ({
			id: 1,
			userId,
			...(body as Record<string, unknown>),
		}),
		reorder: async (userId: number, ids: number[]) =>
			ids.map((id, index) => ({ id, userId, position: index })),
		update: async (userId: number, id: number, patch: unknown) => ({
			id,
			userId,
			...(patch as Record<string, unknown>),
		}),
		remove: async () => true,
		...overrides,
	} as unknown as TaskService
}

function stubAuthService(): AuthService {
	return {
		register: async (input: {
			name: string
			email: string
			password: string
		}) => ({
			id: 1,
			name: input.name,
			email: input.email,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
		}),
		login: async () => ({ token: 'stub-token' }),
	} as unknown as AuthService
}

function stubActivity() {
	return {
		record: async () => {
			throw new Error('not used here')
		},
		findByTask: async (taskId: number, userId: number) => [
			{
				id: 'abc123',
				taskId,
				userId,
				action: 'created',
				changes: { title: { from: null, to: 'Tarefa' } },
				occurredAt: new Date('2026-02-01T00:00:00.000Z'),
			},
			{
				id: 'def456',
				taskId,
				userId,
				action: 'completed',
				changes: null,
				occurredAt: new Date('2026-02-02T00:00:00.000Z'),
			},
		],
		findByUser: async (userId: number) => [
			{
				id: 'abc123',
				taskId: 7,
				userId,
				action: 'created',
				changes: null,
				occurredAt: new Date('2026-02-01T00:00:00.000Z'),
			},
		],
	}
}

describe('HTTP coverage (unit, buildApp sem bancos)', () => {
	let snapshot: Record<string, string | undefined>
	let app: FastifyInstance
	let token: string

	beforeAll(async () => {
		snapshot = { ...process.env }
		process.env.JWT_SECRET = JWT_SECRET
		;({ buildApp } = await import('../../src/app.js'))
		;({ ConflictError } = await import(
			'../../src/shared/errors/conflict.error.js'
		))
		;({ NotFoundError } = await import(
			'../../src/shared/errors/not-found.error.js'
		))
		app = await buildApp({
			db: fakeDb(),
			taskService: stubTaskService(),
			authService: stubAuthService(),
			activityRepository: stubActivity() as never,
		})
		token = app.jwt.sign({ sub: 1, name: 'Ada', email: 'ada@essentia.com' })
	})

	afterAll(async () => {
		await app.close()
		process.env = { ...snapshot }
	})

	const auth = () => ({ authorization: `Bearer ${token}` })

	it('GET /health retorna 200 com banco fake no ar', async () => {
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual({ status: 'ok', db: 'up' })
	})

	it('rota inexistente retorna 404 NOT_FOUND padronizado', async () => {
		const res = await app.inject({ method: 'GET', url: '/nao-existe' })
		expect(res.statusCode).toBe(404)
		expect(res.json()).toEqual({
			code: 'NOT_FOUND',
			message: 'Rota não encontrada',
		})
	})

	it('GET /api/tasks sem token → 401 UNAUTHORIZED', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/tasks' })
		expect(res.statusCode).toBe(401)
		expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
	})

	it('token com sub não-numérico → 401 (currentUserId)', async () => {
		const bad = app.jwt.sign({
			sub: 'x',
			name: 'A',
			email: 'a@b.com',
		} as unknown as { sub: number; name: string; email: string })
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: { authorization: `Bearer ${bad}` },
		})
		expect(res.statusCode).toBe(401)
		expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
	})

	it('GET /api/tasks com token → 200', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: auth(),
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual([])
	})

	it('GET /api/tasks/1 com token → 200', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks/1',
			headers: auth(),
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toMatchObject({ id: 1, userId: 1 })
	})

	it('GET /api/tasks/abc → 400 VALIDATION_ERROR (params)', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks/abc',
			headers: auth(),
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('POST /api/tasks válido → 201', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: auth(),
			payload: { title: 'Nova' },
		})
		expect(res.statusCode).toBe(201)
		expect(res.json()).toMatchObject({ title: 'Nova', userId: 1 })
	})

	it('POST /api/tasks {} → 400 VALIDATION_ERROR com details', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: auth(),
			payload: {},
		})
		expect(res.statusCode).toBe(400)
		const body = res.json() as { code: string; details: unknown[] }
		expect(body.code).toBe('VALIDATION_ERROR')
		expect(body.details.length).toBeGreaterThan(0)
	})

	it('PATCH /api/tasks/reorder válido → 200', async () => {
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/reorder',
			headers: auth(),
			payload: { ids: [2, 1] },
		})
		expect(res.statusCode).toBe(200)
	})

	it('PATCH /api/tasks/1 válido → 200', async () => {
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/1',
			headers: auth(),
			payload: { completed: true },
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toMatchObject({ completed: true })
	})

	it('DELETE /api/tasks/1 → 204', async () => {
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/tasks/1',
			headers: auth(),
		})
		expect(res.statusCode).toBe(204)
	})

	it('POST /api/auth/register válido → 201', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: {
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			},
		})
		expect(res.statusCode).toBe(201)
		expect(res.json()).toMatchObject({
			name: 'Ada',
			email: 'ada@essentia.com',
		})
	})

	it('POST /api/auth/register email inválido → 400 com mensagem pt-BR', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: { name: 'Ada', email: 'sem-arroba', password: 'segredo12' },
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toMatchObject({
			code: 'VALIDATION_ERROR',
			details: [
				{
					field: 'email',
					message: 'E-mail inválido. Corrija e tente novamente.',
				},
			],
		})
	})

	it('POST /api/auth/login válido → 200 {token}', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ada@essentia.com', password: 'segredo12' },
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual({ token: 'stub-token' })
	})

	it('GET /api/tasks/1/history mapeia DTO (changes objeto e null)', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks/1/history',
			headers: auth(),
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual([
			{
				id: 'abc123',
				taskId: 1,
				userId: 1,
				action: 'created',
				changes: { title: { from: null, to: 'Tarefa' } },
				occurredAt: '2026-02-01T00:00:00.000Z',
			},
			{
				id: 'def456',
				taskId: 1,
				userId: 1,
				action: 'completed',
				changes: null,
				occurredAt: '2026-02-02T00:00:00.000Z',
			},
		])
	})

	it('GET /api/activity retorna feed do usuário', async () => {
		const res = await app.inject({
			method: 'GET',
			url: '/api/activity',
			headers: auth(),
		})
		expect(res.statusCode).toBe(200)
		expect(res.json()).toEqual([
			{
				id: 'abc123',
				taskId: 7,
				userId: 1,
				action: 'created',
				changes: null,
				occurredAt: '2026-02-01T00:00:00.000Z',
			},
		])
	})
})

describe('HTTP errors (unit, stubs que lançam)', () => {
	let snapshot: Record<string, string | undefined>
	let apps: FastifyInstance[] = []

	beforeAll(() => {
		snapshot = { ...process.env }
		process.env.JWT_SECRET = JWT_SECRET
	})

	afterAll(async () => {
		for (const app of apps) {
			await app.close()
		}
		apps = []
		process.env = { ...snapshot }
	})

	async function buildWith(
		taskOverrides: Record<string, unknown>,
		activityRepository?: never,
	): Promise<{ app: FastifyInstance; token: string }> {
		const app = await buildApp({
			db: fakeDb(),
			taskService: stubTaskService(taskOverrides),
			authService: stubAuthService(),
			activityRepository,
		})
		apps.push(app)
		const token = app.jwt.sign({ sub: 1, name: 'Ada', email: 'a@b.com' })
		return { app, token }
	}

	it('GET /health com banco fora → 503 DB_UNAVAILABLE', async () => {
		const app = await buildApp({
			db: fakeDb(async () => {
				throw new Error('db down')
			}),
			taskService: stubTaskService(),
			authService: stubAuthService(),
		})
		apps.push(app)
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(503)
		expect(res.json()).toEqual({
			code: 'DB_UNAVAILABLE',
			message: 'Banco de dados indisponível',
		})
	})

	it('history sem activity configurada → [] nas duas rotas', async () => {
		const { app, token } = await buildWith({})
		const headers = { authorization: `Bearer ${token}` }
		for (const url of ['/api/tasks/1/history', '/api/activity']) {
			const res = await app.inject({ method: 'GET', url, headers })
			expect(res.statusCode).toBe(200)
			expect(res.json()).toEqual([])
		}
	})

	it('AppError com details → status + code + details', async () => {
		const { app, token } = await buildWith({
			getById: async () => {
				throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', {
					missingIds: [9],
				})
			},
		})
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks/9',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(404)
		expect(res.json()).toEqual({
			code: 'TASK_NOT_FOUND',
			message: 'Tarefa não encontrada',
			details: { missingIds: [9] },
		})
	})

	it('AppError sem details → sem chave details', async () => {
		const { app, token } = await buildWith({
			remove: async () => {
				throw new ConflictError('Posição em conflito')
			},
		})
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/tasks/1',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(409)
		const body = res.json() as Record<string, unknown>
		expect(body).toEqual({ code: 'CONFLICT', message: 'Posição em conflito' })
		expect(body).not.toHaveProperty('details')
	})

	it('erro com statusCode 429 → RATE_LIMITED', async () => {
		const { app, token } = await buildWith({
			list: async () => {
				throw Object.assign(new Error('limite'), { statusCode: 429 })
			},
		})
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(429)
		expect(res.json()).toMatchObject({ code: 'RATE_LIMITED' })
	})

	it('erro 4xx genérico → 400 BAD_REQUEST', async () => {
		const { app, token } = await buildWith({
			list: async () => {
				throw Object.assign(new Error('teapot'), { statusCode: 418 })
			},
		})
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toMatchObject({ code: 'BAD_REQUEST' })
	})

	it('erro sem status → 500 INTERNAL_ERROR', async () => {
		const { app, token } = await buildWith({
			list: async () => {
				throw new Error('boom')
			},
		})
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(500)
		expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR' })
	})

	it('erro 5xx não-500 preserva o status com INTERNAL_ERROR', async () => {
		const { app, token } = await buildWith({
			list: async () => {
				throw Object.assign(new Error('bad gateway'), { statusCode: 502 })
			},
		})
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: { authorization: `Bearer ${token}` },
		})
		expect(res.statusCode).toBe(502)
		expect(res.json()).toMatchObject({ code: 'INTERNAL_ERROR' })
	})
})
