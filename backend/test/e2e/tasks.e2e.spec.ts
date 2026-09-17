import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'

// Happy paths do CRUD contra o MySQL de teste (todo_test) via fastify.inject.
// NÃO parallel-safe: truncate/DELETE no setup + suíte sequencial (singleFork).
describe('tasks CRUD (e2e happy paths)', () => {
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

  beforeEach(async () => {
    await db.query('DELETE FROM tasks')
  })

  it('fluxo completo: criar → listar → buscar por id → editar → toggle → excluir', async () => {
    // criar (201 + trim aplicado)
    const created = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: '  Aprender Fastify  ', description: 'demo' },
    })
    expect(created.statusCode).toBe(201)
    const task = created.json() as { id: number; title: string; completed: boolean }
    expect(task.id).toBeGreaterThan(0)
    expect(task.title).toBe('Aprender Fastify')
    expect(task.completed).toBe(false)

    // listar
    const listed = await app.inject({ method: 'GET', url: '/api/tasks' })
    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toHaveLength(1)

    // buscar por id (M1)
    const got = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` })
    expect(got.statusCode).toBe(200)
    expect((got.json() as { title: string }).title).toBe('Aprender Fastify')

    // editar
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { title: 'Aprender Fastify 5' },
    })
    expect(patched.statusCode).toBe(200)
    expect((patched.json() as { title: string }).title).toBe('Aprender Fastify 5')

    // toggle de completed
    const toggled = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { completed: true },
    })
    expect(toggled.statusCode).toBe(200)
    expect((toggled.json() as { completed: boolean }).completed).toBe(true)

    // excluir (204) + leitura posterior 404
    const deleted = await app.inject({ method: 'DELETE', url: `/api/tasks/${task.id}` })
    expect(deleted.statusCode).toBe(204)
    const gone = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` })
    expect(gone.statusCode).toBe(404)
    expect((gone.json() as { code: string }).code).toBe('TASK_NOT_FOUND')
  })

  it('GET por id inexistente → 404 TASK_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks/999999' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
  })

  it('lista em ordem decrescente de criação', async () => {
    for (const title of ['primeira', 'segunda', 'terceira']) {
      const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title } })
      expect(res.statusCode).toBe(201)
    }
    const res = await app.inject({ method: 'GET', url: '/api/tasks' })
    expect(res.statusCode).toBe(200)
    const titles = (res.json() as Array<{ title: string }>).map((t) => t.title)
    expect(titles).toEqual(['terceira', 'segunda', 'primeira'])
  })
})
