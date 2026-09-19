import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

const TEST_JWT_SECRET = 'e2e-test-secret-min-32-chars-123456'

describe('auth register/login (e2e)', () => {
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
		await db.query('DELETE FROM tasks')
		await db.query('DELETE FROM users')
	})

	it('register 201 cria usuário público (sem passwordHash)', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: {
				name: 'Ada',
				email: 'Ada@Essentia.com',
				password: 'segredo12',
			},
		})
		expect(res.statusCode).toBe(201)
		const body = res.json() as {
			id: number
			name: string
			email: string
			createdAt: string
		}
		expect(body.id).toBeGreaterThan(0)
		expect(body.name).toBe('Ada')
		expect(body.email).toBe('ada@essentia.com')
		expect(typeof body.createdAt).toBe('string')
		expect(body).not.toHaveProperty('passwordHash')
		expect(body).not.toHaveProperty('password')
	})

	it('register duplicado → 409 EMAIL_CONFLICT', async () => {
		const payload = {
			name: 'Ada',
			email: 'ada@essentia.com',
			password: 'segredo12',
		}
		const first = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload,
		})
		expect(first.statusCode).toBe(201)
		const second = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload,
		})
		expect(second.statusCode).toBe(409)
		expect(second.json()).toMatchObject({ code: 'EMAIL_CONFLICT' })
	})

	it('register F7 → 400 (senha curta, email inválido, name whitespace, campo extra, senha >72)', async () => {
		const cases: Array<Record<string, unknown>> = [
			{ name: 'Ada', email: 'ada@essentia.com', password: 'curta' },
			{ name: 'Ada', email: 'sem-arroba', password: 'segredo12' },
			{ name: '   ', email: 'ada@essentia.com', password: 'segredo12' },
			{
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
				admin: true,
			},
			{ name: 'Ada', email: 'ada@essentia.com', password: 'x'.repeat(129) },
			{ name: 'Ada', email: 'ada@essentia.com', password: 'x'.repeat(73) },
		]
		for (const payload of cases) {
			const res = await app.inject({
				method: 'POST',
				url: '/api/auth/register',
				payload,
			})
			expect(res.statusCode).toBe(400)
			expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
		}
	})

	it('email inválido → 400 com detalhe pt-BR e code estável', async () => {
		const requests = [
			{
				method: 'POST',
				payload: { name: 'Ada', email: 'sem-arroba', password: 'segredo12' },
				url: '/api/auth/register',
			},
			{
				method: 'POST',
				payload: { email: 'sem-arroba', password: 'segredo12' },
				url: '/api/auth/login',
			},
		] as const
		for (const req of requests) {
			const res = await app.inject(req)
			expect(res.statusCode).toBe(400)
			expect(res.json()).toMatchObject({
				code: 'VALIDATION_ERROR',
				message: 'Dados inválidos',
				details: [
					{
						field: 'email',
						message: 'E-mail inválido. Corrija e tente novamente.',
					},
				],
			})
		}
	})

	it('senha curta segue F7: detalhe de password, sem mensagem de email', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: { name: 'Ada', email: 'ada@essentia.com', password: 'curta' },
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toMatchObject({
			code: 'VALIDATION_ERROR',
			details: [{ field: 'password' }],
		})
		expect(JSON.stringify(res.json())).not.toContain('E-mail inválido')
	})

	it('login 200 retorna {token} com sub = userId', async () => {
		const created = await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: {
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			},
		})
		const userId = (created.json() as { id: number }).id

		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ada@essentia.com', password: 'segredo12' },
		})
		expect(res.statusCode).toBe(200)
		const { token } = res.json() as { token: string }
		expect(typeof token).toBe('string')
		const decoded = app.jwt.verify<{ sub: number }>(token)
		expect(decoded.sub).toBe(userId)
	})

	it('login inválido → 401 UNAUTHORIZED idêntico (email inexistente = senha errada)', async () => {
		await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: {
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			},
		})
		const missing = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ninguem@essentia.com', password: 'segredo12' },
		})
		const wrong = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ada@essentia.com', password: 'errada123' },
		})
		expect(missing.statusCode).toBe(401)
		expect(wrong.statusCode).toBe(401)
		expect(missing.json()).toMatchObject({ code: 'UNAUTHORIZED' })
		expect(wrong.json()).toEqual(missing.json())
	})

	it('login com senha curta (não-vazia) → 401, não 400', async () => {
		await app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: {
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			},
		})
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ada@essentia.com', password: 'x' },
		})
		expect(res.statusCode).toBe(401)
		expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
	})

	it('login com campo ausente → 400 VALIDATION_ERROR', async () => {
		const res = await app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: { email: 'ada@essentia.com' },
		})
		expect(res.statusCode).toBe(400)
		expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	it('2 registers simultâneos com mesmo email → {201, 409 EMAIL_CONFLICT}, nunca 500', async () => {
		const email = `race-${crypto.randomUUID()}@essentia.com`
		const payload = {
			name: 'Ada',
			email,
			password: 'segredo12',
		}
		const settled = await Promise.allSettled([
			app.inject({ method: 'POST', url: '/api/auth/register', payload }),
			app.inject({ method: 'POST', url: '/api/auth/register', payload }),
		])
		const responses = settled.map((result) => {
			expect(result.status).toBe('fulfilled')
			return (
				result as PromiseFulfilledResult<Awaited<ReturnType<typeof app.inject>>>
			).value
		})
		const statuses = responses
			.map((res) => res.statusCode)
			.sort((a, b) => a - b)
		expect(statuses).toEqual([201, 409])
		const conflict = responses.find((res) => res.statusCode === 409)
		expect(conflict?.json()).toMatchObject({ code: 'EMAIL_CONFLICT' })
	})
})
