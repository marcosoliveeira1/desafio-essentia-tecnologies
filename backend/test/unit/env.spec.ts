import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('env (loadEnv)', () => {
	let snapshot: Record<string, string | undefined>

	beforeEach(() => {
		snapshot = { ...process.env }
		// Suite hermética: JWT_SECRET é obrigatória em QUALQUER ambiente
		// (hardening-03, sem fallback) — success-paths não podem depender do
		// env do processo host (ex.: step de unit tests do CI não a define).
		process.env.JWT_SECRET = 'unit-env-spec-secret-min-32-chars!!'
	})

	afterEach(() => {
		process.env = { ...snapshot }
		vi.resetModules()
	})

	const loadFresh = async () => {
		const { loadEnv } = await import('../../src/env.js')
		return loadEnv()
	}

	describe('CORS_ORIGINS', () => {
		it('unset → undefined (sem allowlist)', async () => {
			delete process.env.CORS_ORIGINS
			const env = await loadFresh()
			expect(env.corsOrigins).toBeUndefined()
		})

		it('csv com espaços → origens trimmadas, vazias filtradas', async () => {
			process.env.CORS_ORIGINS = ' http://a.com, http://b.com , '
			const env = await loadFresh()
			expect(env.corsOrigins).toEqual(['http://a.com', 'http://b.com'])
		})

		it('string vazia → undefined', async () => {
			process.env.CORS_ORIGINS = ''
			const env = await loadFresh()
			expect(env.corsOrigins).toBeUndefined()
		})
	})

	describe('SWAGGER_ENABLED', () => {
		it('unset + NODE_ENV=test → ligado', async () => {
			process.env.NODE_ENV = 'test'
			delete process.env.SWAGGER_ENABLED
			const env = await loadFresh()
			expect(env.swaggerEnabled).toBe(true)
		})

		it('unset + NODE_ENV=production → desligado', async () => {
			process.env.NODE_ENV = 'production'
			delete process.env.SWAGGER_ENABLED
			const env = await loadFresh()
			expect(env.swaggerEnabled).toBe(false)
		})

		it('"true" explícito → ligado', async () => {
			process.env.NODE_ENV = 'production'
			process.env.SWAGGER_ENABLED = 'true'
			const env = await loadFresh()
			expect(env.swaggerEnabled).toBe(true)
		})

		it('"false" explícito → desligado', async () => {
			process.env.NODE_ENV = 'test'
			process.env.SWAGGER_ENABLED = 'false'
			const env = await loadFresh()
			expect(env.swaggerEnabled).toBe(false)
		})

		it('valor inválido → erro fail-fast', async () => {
			process.env.SWAGGER_ENABLED = 'sim'
			await expect(loadFresh()).rejects.toThrow(/SWAGGER_ENABLED/)
		})
	})

	describe('JWT_SECRET (sem fallback)', () => {
		it('ausente em development → erro fail-fast', async () => {
			process.env.NODE_ENV = 'development'
			delete process.env.JWT_SECRET
			await expect(loadFresh()).rejects.toThrow(/JWT_SECRET/)
		})

		it('ausente em production → erro fail-fast', async () => {
			process.env.NODE_ENV = 'production'
			delete process.env.JWT_SECRET
			await expect(loadFresh()).rejects.toThrow(/JWT_SECRET/)
		})

		it('32 caracteres → aceito', async () => {
			delete process.env.NODE_ENV
			process.env.JWT_SECRET = 'a'.repeat(32)
			const env = await loadFresh()
			expect(env.auth.jwtSecret).toBe('a'.repeat(32))
		})

		it('31 caracteres → erro de comprimento', async () => {
			delete process.env.NODE_ENV
			process.env.JWT_SECRET = 'a'.repeat(31)
			await expect(loadFresh()).rejects.toThrow(/32 caracteres/)
		})
	})
})
