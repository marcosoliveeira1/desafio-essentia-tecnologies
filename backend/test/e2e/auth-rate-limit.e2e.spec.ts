import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

const LIMITED_IP = '203.0.113.10'

// TEST-NET-2: distinto de LIMITED_IP (203.0.113.10, TEST-NET-1) e nunca
// allowlisted (só 127.0.0.1 no env de teste) — IPs sintéticos únicos por caso
// evitam poluição de bucket entre testes (spec hardening-03, edge case).
const XFF_LIMITED_IP = '198.51.100.10'
const XFF_OTHER_IP = '198.51.100.11'

function loginRequest(ip: string) {
	return {
		method: 'POST' as const,
		url: '/api/auth/login',
		remoteAddress: ip,
		payload: { email: 'ninguem@essentia.com', password: 'errada123' },
	}
}

function loginRequestBehindProxy(forwardedFor: string) {
	return {
		method: 'POST' as const,
		url: '/api/auth/login',
		remoteAddress: '127.0.0.1', // socket do proxy (Caddy), não do cliente
		headers: { 'x-forwarded-for': forwardedFor },
		payload: { email: 'ninguem@essentia.com', password: 'errada123' },
	}
}

describe('helmet + rate-limit no auth (e2e)', () => {
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

	it('qualquer resposta inclui headers helmet (H3a)', async () => {
		const res = await app.inject({ method: 'GET', url: '/health' })
		expect(res.statusCode).toBe(200)
		expect(res.headers['x-content-type-options']).toBe('nosniff')
		expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
		expect(res.headers['x-dns-prefetch-control']).toBe('off')
	})

	it('6 POSTs /api/auth/login do mesmo IP → 5×401 + 1×429 envelope RATE_LIMITED (H3b)', async () => {
		for (let i = 0; i < 5; i++) {
			const res = await app.inject(loginRequest(LIMITED_IP))
			expect(res.statusCode).toBe(401)
		}
		const sixth = await app.inject(loginRequest(LIMITED_IP))
		expect(sixth.statusCode).toBe(429)
		expect(sixth.json()).toMatchObject({
			code: 'RATE_LIMITED',
			message: 'Muitas tentativas. Aguarde um instante e tente novamente.',
		})
		expect(sixth.headers['retry-after']).toBeDefined()
	})

	it('trustProxy: 5 logins do mesmo x-forwarded-for → 429 no 6º; IP via header distinto passa (PR-03)', async () => {
		for (let i = 0; i < 5; i++) {
			const res = await app.inject(loginRequestBehindProxy(XFF_LIMITED_IP))
			expect(res.statusCode).toBe(401)
		}
		const sixth = await app.inject(loginRequestBehindProxy(XFF_LIMITED_IP))
		expect(sixth.statusCode).toBe(429)
		expect(sixth.json()).toMatchObject({
			code: 'RATE_LIMITED',
			message: 'Muitas tentativas. Aguarde um instante e tente novamente.',
		})
		expect(sixth.headers['retry-after']).toBeDefined()

		const other = await app.inject(loginRequestBehindProxy(XFF_OTHER_IP))
		expect(other.statusCode).toBe(401)
	})

	it('CRUD/docs/health fora do limite: 7 GETs seguidos de IP estourado → todos 200 (H3c)', async () => {
		for (let i = 0; i < 7; i++) {
			const res = await app.inject({
				method: 'GET',
				url: '/health',
				remoteAddress: LIMITED_IP,
			})
			expect(res.statusCode).toBe(200)
		}
		const docs = await app.inject({
			method: 'GET',
			url: '/api/docs/json',
			remoteAddress: LIMITED_IP,
		})
		expect(docs.statusCode).toBe(200)
	})

	it('allowlist default do ambiente de teste (127.0.0.1) não sofre 429 (H3d)', async () => {
		for (let i = 0; i < 7; i++) {
			const res = await app.inject(loginRequest('127.0.0.1'))
			expect(res.statusCode).toBe(401)
		}
	})
})
