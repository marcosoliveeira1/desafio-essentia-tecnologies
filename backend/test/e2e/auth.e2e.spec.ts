import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

// Auth register/login contra o MySQL de teste (todo_test) via fastify.inject.
// NÃO parallel-safe: DELETE no setup + suíte sequencial (singleFork).
// Ordem do truncate: tasks ANTES de users (FK tasks.userId → users.id).
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
      payload: { name: 'Ada', email: 'Ada@TechX.com', password: 'segredo12' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: number; name: string; email: string; createdAt: string }
    expect(body.id).toBeGreaterThan(0)
    expect(body.name).toBe('Ada')
    expect(body.email).toBe('ada@techx.com')
    expect(typeof body.createdAt).toBe('string')
    expect(body).not.toHaveProperty('passwordHash')
    expect(body).not.toHaveProperty('password')
  })

  it('register duplicado → 409 EMAIL_CONFLICT', async () => {
    const payload = { name: 'Ada', email: 'ada@techx.com', password: 'segredo12' }
    const first = await app.inject({ method: 'POST', url: '/api/auth/register', payload })
    expect(first.statusCode).toBe(201)
    const second = await app.inject({ method: 'POST', url: '/api/auth/register', payload })
    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({ code: 'EMAIL_CONFLICT' })
  })

  it('register F7 → 400 (senha curta, email inválido, name whitespace, campo extra)', async () => {
    const cases: Array<Record<string, unknown>> = [
      { name: 'Ada', email: 'ada@techx.com', password: 'curta' },
      { name: 'Ada', email: 'sem-arroba', password: 'segredo12' },
      { name: '   ', email: 'ada@techx.com', password: 'segredo12' },
      { name: 'Ada', email: 'ada@techx.com', password: 'segredo12', admin: true },
      { name: 'Ada', email: 'ada@techx.com', password: 'x'.repeat(129) },
    ]
    for (const payload of cases) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
  })

  it('login 200 retorna {token} com sub = userId', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Ada', email: 'ada@techx.com', password: 'segredo12' },
    })
    const userId = (created.json() as { id: number }).id

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ada@techx.com', password: 'segredo12' },
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
      payload: { name: 'Ada', email: 'ada@techx.com', password: 'segredo12' },
    })
    const missing = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ninguem@techx.com', password: 'segredo12' },
    })
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ada@techx.com', password: 'errada123' },
    })
    expect(missing.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(missing.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    // Idênticos: corpo igual (não vaza se o email existe).
    expect(wrong.json()).toEqual(missing.json())
  })

  it('login com senha curta (não-vazia) → 401, não 400', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Ada', email: 'ada@techx.com', password: 'segredo12' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ada@techx.com', password: 'x' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('login com campo ausente → 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ada@techx.com' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
