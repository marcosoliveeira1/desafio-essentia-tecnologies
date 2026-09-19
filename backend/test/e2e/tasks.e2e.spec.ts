import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'
import type { TaskService } from '../../src/modules/tasks/task.service.js'

const TEST_JWT_SECRET = 'e2e-test-secret-min-32-chars-123456'

let userSeq = 0
async function authHeaders(
	app: FastifyInstance,
): Promise<Record<string, string>> {
	userSeq += 1
	const email = `user${Date.now()}_${userSeq}@essentia.com`
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

async function truncate(db: DataSource): Promise<void> {
	await db.query('DELETE FROM tasks')
	await db.query('DELETE FROM users')
}

describe('tasks CRUD (e2e happy paths)', () => {
	let app: FastifyInstance
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		app = await buildApp({ db, jwtSecret: TEST_JWT_SECRET })
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await truncate(db)
	})

	it('fluxo completo: criar → listar → buscar por id → editar → toggle → excluir', async () => {
		const headers = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: '  Aprender Fastify  ', description: 'demo' },
		})
		expect(created.statusCode).toBe(201)
		const task = created.json() as {
			id: number
			title: string
			completed: boolean
			userId: number
		}
		expect(task.id).toBeGreaterThan(0)
		expect(task.title).toBe('Aprender Fastify')
		expect(task.completed).toBe(false)

		const listed = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers,
		})
		expect(listed.statusCode).toBe(200)
		expect(listed.json()).toHaveLength(1)

		const got = await app.inject({
			method: 'GET',
			url: `/api/tasks/${task.id}`,
			headers,
		})
		expect(got.statusCode).toBe(200)
		expect((got.json() as { title: string }).title).toBe('Aprender Fastify')

		const patched = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${task.id}`,
			headers,
			payload: { title: 'Aprender Fastify 5' },
		})
		expect(patched.statusCode).toBe(200)
		expect((patched.json() as { title: string }).title).toBe(
			'Aprender Fastify 5',
		)

		const toggled = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${task.id}`,
			headers,
			payload: { completed: true },
		})
		expect(toggled.statusCode).toBe(200)
		expect((toggled.json() as { completed: boolean }).completed).toBe(true)

		const deleted = await app.inject({
			method: 'DELETE',
			url: `/api/tasks/${task.id}`,
			headers,
		})
		expect(deleted.statusCode).toBe(204)
		const gone = await app.inject({
			method: 'GET',
			url: `/api/tasks/${task.id}`,
			headers,
		})
		expect(gone.statusCode).toBe(404)
		expect((gone.json() as { code: string }).code).toBe('TASK_NOT_FOUND')
	})

	it('POST com completed:true nasce em Concluídas (PR-18b)', async () => {
		const headers = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'já feita', completed: true },
		})
		expect(created.statusCode).toBe(201)
		const task = created.json() as {
			id: number
			title: string
			completed: boolean
		}
		expect(task.completed).toBe(true)

		const got = await app.inject({
			method: 'GET',
			url: `/api/tasks/${task.id}`,
			headers,
		})
		expect(got.statusCode).toBe(200)
		expect((got.json() as { completed: boolean }).completed).toBe(true)

		const listed = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers,
		})
		expect(listed.statusCode).toBe(200)
		const found = (
			listed.json() as Array<{ id: number; completed: boolean }>
		).find((t) => t.id === task.id)
		expect(found?.completed).toBe(true)
	})

	it('GET por id inexistente → 404 TASK_NOT_FOUND', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'GET',
			url: '/api/tasks/999999',
			headers,
		})
		expect(res.statusCode).toBe(404)
		expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
	})

	it('lista em ordem crescente de position', async () => {
		const headers = await authHeaders(app)
		for (const title of ['primeira', 'segunda', 'terceira']) {
			const res = await app.inject({
				method: 'POST',
				url: '/api/tasks',
				headers,
				payload: { title },
			})
			expect(res.statusCode).toBe(201)
		}
		const res = await app.inject({ method: 'GET', url: '/api/tasks', headers })
		expect(res.statusCode).toBe(200)
		const titles = (res.json() as Array<{ title: string }>).map((t) => t.title)
		expect(titles).toEqual(['primeira', 'segunda', 'terceira'])
	})

	it('reorder via PATCH {position} reflete no GET em position asc', async () => {
		const headers = await authHeaders(app)
		const ids: number[] = []
		for (const title of ['primeira', 'segunda', 'terceira']) {
			const res = await app.inject({
				method: 'POST',
				url: '/api/tasks',
				headers,
				payload: { title },
			})
			expect(res.statusCode).toBe(201)
			ids.push((res.json() as { id: number }).id)
		}
		const patched = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${ids[2]}`,
			headers,
			payload: { position: 0 },
		})
		expect(patched.statusCode).toBe(200)
		expect((patched.json() as { position: number }).position).toBe(0)
		const res = await app.inject({ method: 'GET', url: '/api/tasks', headers })
		expect(res.statusCode).toBe(200)
		const titles = (res.json() as Array<{ title: string }>).map((t) => t.title)
		expect(titles).toEqual(['terceira', 'primeira', 'segunda'])
	})
})

describe('tasks validation and error edge cases (e2e)', () => {
	let app: FastifyInstance
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		app = await buildApp({ db, jwtSecret: TEST_JWT_SECRET })
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await truncate(db)
	})

	it('POST com title vazio → 400 VALIDATION_ERROR com details', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: '' },
		})
		expect(res.statusCode).toBe(400)
		const body = res.json() as {
			code: string
			message: string
			details: unknown[]
		}
		expect(body.code).toBe('VALIDATION_ERROR')
		expect(typeof body.message).toBe('string')
		expect(Array.isArray(body.details)).toBe(true)
	})

	it('POST com title whitespace-only F3 → 400', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: '    ' },
		})
		expect(res.statusCode).toBe(400)
		expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
	})

	it('POST com title de 256 chars → 400 com details', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'x'.repeat(256) },
		})
		expect(res.statusCode).toBe(400)
		const body = res.json() as { code: string; details: unknown[] }
		expect(body.code).toBe('VALIDATION_ERROR')
		expect(Array.isArray(body.details)).toBe(true)
	})

	it('POST com description > 2000 chars → 400', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'ok', description: 'y'.repeat(2001) },
		})
		expect(res.statusCode).toBe(400)
		expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
	})

	it('PATCH de id inexistente → 404 TASK_NOT_FOUND', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/888888',
			headers,
			payload: { title: 'x' },
		})
		expect(res.statusCode).toBe(404)
		expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
	})

	it('DELETE de id inexistente → 404 TASK_NOT_FOUND', async () => {
		const headers = await authHeaders(app)
		const res = await app.inject({
			method: 'DELETE',
			url: '/api/tasks/888888',
			headers,
		})
		expect(res.statusCode).toBe(404)
		expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
	})

	it('PATCH com body vazio → 400', async () => {
		const headers = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'x' },
		})
		const id = (created.json() as { id: number }).id
		const res = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${id}`,
			headers,
			payload: {},
		})
		expect(res.statusCode).toBe(400)
		expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
	})

	it('tipos errados → 400 (title numérico, completed texto, id não-numérico)', async () => {
		const headers = await authHeaders(app)
		const badTitle = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 123 },
		})
		expect(badTitle.statusCode).toBe(400)

		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'x' },
		})
		const id = (created.json() as { id: number }).id
		const badCompleted = await app.inject({
			method: 'PATCH',
			url: `/api/tasks/${id}`,
			headers,
			payload: { completed: 'yes' },
		})
		expect(badCompleted.statusCode).toBe(400)

		for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
			const res = await app.inject({
				method,
				url: '/api/tasks/abc',
				headers,
				...(method === 'PATCH' ? { payload: { title: 'x' } } : {}),
			})
			expect(res.statusCode).toBe(400)
		}
	})

	it('PATCH com position inválido → 400 (position -1, "x", 1.5)', async () => {
		const headers = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers,
			payload: { title: 'x' },
		})
		const id = (created.json() as { id: number }).id
		for (const position of [-1, 'x', 1.5]) {
			const res = await app.inject({
				method: 'PATCH',
				url: `/api/tasks/${id}`,
				headers,
				payload: { position },
			})
			expect(res.statusCode).toBe(400)
			expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
		}
	})

	it('POST com JSON malformado → 400 BAD_REQUEST (não INTERNAL_ERROR)', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: { 'content-type': 'application/json' },
			payload: '{inválido',
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toEqual({
			code: 'BAD_REQUEST',
			message: 'Requisição inválida',
		})
	})

	it('erro inesperado → 500 padronizado INTERNAL_ERROR (simulado)', async () => {
		const headers = await authHeaders(app)
		const boomService = {
			list: async (_userId: number): Promise<never> => {
				throw new Error('boom simulado')
			},
		} as unknown as TaskService
		const boomApp = await buildApp({
			db,
			jwtSecret: TEST_JWT_SECRET,
			taskService: boomService,
		})
		try {
			const res = await boomApp.inject({
				method: 'GET',
				url: '/api/tasks',
				headers,
			})
			expect(res.statusCode).toBe(500)
			expect(res.json()).toEqual({
				code: 'INTERNAL_ERROR',
				message: 'Erro interno do servidor',
			})
		} finally {
			await boomApp.close()
		}
	})
})

describe('tasks reorder (e2e)', () => {
	let app: FastifyInstance
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		app = await buildApp({ db, jwtSecret: TEST_JWT_SECRET })
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await truncate(db)
	})

	async function createTitles(
		headers: Record<string, string>,
		titles: string[],
	): Promise<number[]> {
		const ids: number[] = []
		for (const title of titles) {
			const res = await app.inject({
				method: 'POST',
				url: '/api/tasks',
				headers,
				payload: { title },
			})
			expect(res.statusCode).toBe(201)
			ids.push((res.json() as { id: number }).id)
		}
		return ids
	}

	it('happy 200: reorder aplica ordem + GET confirma positions 0,1,2', async () => {
		const headers = await authHeaders(app)
		const ids = await createTitles(headers, ['primeira', 'segunda', 'terceira'])
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/reorder',
			headers,
			payload: { ids: [ids[2], ids[0], ids[1]] },
		})
		expect(res.statusCode).toBe(200)
		const body = res.json() as Array<{ id: number; position: number }>
		expect(body.map((t) => t.id)).toEqual([ids[2], ids[0], ids[1]])
		expect(body.map((t) => t.position)).toEqual([0, 1, 2])
		const listed = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers,
		})
		expect(listed.statusCode).toBe(200)
		const titles = (listed.json() as Array<{ title: string }>).map(
			(t) => t.title,
		)
		expect(titles).toEqual(['terceira', 'primeira', 'segunda'])
	})

	it('edges 400: vazio/duplicado/<1/não-inteiro → VALIDATION_ERROR {code,message,details}', async () => {
		const headers = await authHeaders(app)
		const ids = await createTitles(headers, ['a', 'b'])
		const cases: Array<Record<string, unknown>> = [
			{ ids: [] },
			{ ids: [ids[0], ids[0]] },
			{ ids: [0] },
			{ ids: [-1] },
			{ ids: [1.5] },
			{ ids: ['x'] },
			{ ids: 'nao-array' },
		]
		for (const payload of cases) {
			const res = await app.inject({
				method: 'PATCH',
				url: '/api/tasks/reorder',
				headers,
				payload,
			})
			expect(res.statusCode).toBe(400)
			const body = res.json() as {
				code: string
				message: string
				details: unknown
			}
			expect(body.code).toBe('VALIDATION_ERROR')
			expect(typeof body.message).toBe('string')
			expect(body.details).toBeDefined()
		}
	})

	it('edge 404: id inexistente → TASK_NOT_FOUND com missingIds', async () => {
		const headers = await authHeaders(app)
		const ids = await createTitles(headers, ['a', 'b'])
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/reorder',
			headers,
			payload: { ids: [ids[0], 999999] },
		})
		expect(res.statusCode).toBe(404)
		const body = res.json() as {
			code: string
			message: string
			details: { missingIds: number[] }
		}
		expect(body.code).toBe('TASK_NOT_FOUND')
		expect(typeof body.message).toBe('string')
		expect(body.details.missingIds).toEqual([999999])
	})
})

describe('tasks auth scope (e2e)', () => {
	let app: FastifyInstance
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
		app = await buildApp({ db, jwtSecret: TEST_JWT_SECRET })
	})

	afterAll(async () => {
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await truncate(db)
	})

	it('401 sem token em todos os verbos (incl. reorder)', async () => {
		const noAuth: Array<{
			method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
			url: string
			payload?: unknown
		}> = [
			{ method: 'GET', url: '/api/tasks' },
			{ method: 'GET', url: '/api/tasks/1' },
			{ method: 'POST', url: '/api/tasks', payload: { title: 'x' } },
			{ method: 'PATCH', url: '/api/tasks/reorder', payload: { ids: [1] } },
			{ method: 'PATCH', url: '/api/tasks/1', payload: { title: 'x' } },
			{ method: 'DELETE', url: '/api/tasks/1' },
		]
		for (const req of noAuth) {
			const res = await app.inject({
				method: req.method,
				url: req.url,
				...(req.payload ? { payload: req.payload } : {}),
			})
			expect(res.statusCode).toBe(401)
			expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
		}
	})

	it('401 com token inválido em todos os verbos (incl. reorder)', async () => {
		const headers = { authorization: 'Bearer invalido' }
		const cases: Array<{
			method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
			url: string
			payload?: unknown
		}> = [
			{ method: 'GET', url: '/api/tasks' },
			{ method: 'GET', url: '/api/tasks/1' },
			{ method: 'POST', url: '/api/tasks', payload: { title: 'x' } },
			{ method: 'PATCH', url: '/api/tasks/reorder', payload: { ids: [1] } },
			{ method: 'PATCH', url: '/api/tasks/1', payload: { title: 'x' } },
			{ method: 'DELETE', url: '/api/tasks/1' },
		]
		for (const req of cases) {
			const res = await app.inject({
				method: req.method,
				url: req.url,
				headers,
				...(req.payload ? { payload: req.payload } : {}),
			})
			expect(res.statusCode).toBe(401)
			expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
		}
	})

	it('create vincula userId do token; list é escopado (A não vê B)', async () => {
		const headersA = await authHeaders(app)
		const headersB = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: headersA,
			payload: { title: 'de-A' },
		})
		expect(created.statusCode).toBe(201)
		expect((created.json() as { userId: number }).userId).toBeGreaterThan(0)

		const listA = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: headersA,
		})
		expect(
			(listA.json() as Array<{ title: string }>).map((t) => t.title),
		).toEqual(['de-A'])
		const listB = await app.inject({
			method: 'GET',
			url: '/api/tasks',
			headers: headersB,
		})
		expect(listB.json()).toEqual([])
	})

	it('cross-user GET/PATCH/DELETE → 404 TASK_NOT_FOUND', async () => {
		const headersA = await authHeaders(app)
		const headersB = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: headersA,
			payload: { title: 'secreta' },
		})
		const id = (created.json() as { id: number }).id

		for (const req of [
			{ method: 'GET', url: `/api/tasks/${id}` },
			{ method: 'PATCH', url: `/api/tasks/${id}`, payload: { title: 'hack' } },
			{ method: 'DELETE', url: `/api/tasks/${id}` },
		] as const) {
			const res = await app.inject({
				method: req.method,
				url: req.url,
				headers: headersB,
				...('payload' in req ? { payload: req.payload } : {}),
			})
			expect(res.statusCode).toBe(404)
			expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
		}
		const got = await app.inject({
			method: 'GET',
			url: `/api/tasks/${id}`,
			headers: headersA,
		})
		expect(got.statusCode).toBe(200)
	})

	it('reorder cross-user → 404 TASK_NOT_FOUND com missingIds', async () => {
		const headersA = await authHeaders(app)
		const headersB = await authHeaders(app)
		const created = await app.inject({
			method: 'POST',
			url: '/api/tasks',
			headers: headersA,
			payload: { title: 'a' },
		})
		const id = (created.json() as { id: number }).id
		const res = await app.inject({
			method: 'PATCH',
			url: '/api/tasks/reorder',
			headers: headersB,
			payload: { ids: [id] },
		})
		expect(res.statusCode).toBe(404)
		const body = res.json() as {
			code: string
			details: { missingIds: number[] }
		}
		expect(body.code).toBe('TASK_NOT_FOUND')
		expect(body.details.missingIds).toEqual([id])
	})
})
