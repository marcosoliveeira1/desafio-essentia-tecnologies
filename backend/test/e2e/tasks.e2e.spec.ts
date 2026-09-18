import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'
import type { TaskService } from '../../src/modules/tasks/task.service.js'

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

  it('lista em ordem crescente de position', async () => {
    for (const title of ['primeira', 'segunda', 'terceira']) {
      const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title } })
      expect(res.statusCode).toBe(201)
    }
    const res = await app.inject({ method: 'GET', url: '/api/tasks' })
    expect(res.statusCode).toBe(200)
    const titles = (res.json() as Array<{ title: string }>).map((t) => t.title)
    expect(titles).toEqual(['primeira', 'segunda', 'terceira'])
  })

  it('reorder via PATCH {position} reflete no GET em position asc', async () => {
    const ids: number[] = []
    for (const title of ['primeira', 'segunda', 'terceira']) {
      const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title } })
      expect(res.statusCode).toBe(201)
      ids.push((res.json() as { id: number }).id)
    }
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${ids[2]}`,
      payload: { position: 0 },
    })
    expect(patched.statusCode).toBe(200)
    expect((patched.json() as { position: number }).position).toBe(0)
    const res = await app.inject({ method: 'GET', url: '/api/tasks' })
    expect(res.statusCode).toBe(200)
    const titles = (res.json() as Array<{ title: string }>).map((t) => t.title)
    expect(titles).toEqual(['terceira', 'primeira', 'segunda'])
  })
})

// Edge cases de validação + erros HTTP (API-06). Mesmo banco/arquivo do happy path,
// em describe separado p/ manter a ordem de execução legível (suíte sequencial).
describe('tasks validation and error edge cases (e2e)', () => {
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

  it('POST com title vazio → 400 VALIDATION_ERROR com details', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: '' } })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { code: string; message: string; details: unknown[] }
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(typeof body.message).toBe('string')
    expect(Array.isArray(body.details)).toBe(true)
  })

  it('POST com title whitespace-only F3 → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: '    ' } })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
  })

  it('POST com title de 256 chars → 400 com details', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x'.repeat(256) } })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { code: string; details: unknown[] }
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(body.details)).toBe(true)
  })

  it('POST com description > 2000 chars → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'ok', description: 'y'.repeat(2001) },
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
  })

  it('PATCH de id inexistente → 404 TASK_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/tasks/888888', payload: { title: 'x' } })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
  })

  it('DELETE de id inexistente → 404 TASK_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/tasks/888888' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ code: 'TASK_NOT_FOUND' })
  })

  it('PATCH com body vazio → 400', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x' } })
    const id = (created.json() as { id: number }).id
    const res = await app.inject({ method: 'PATCH', url: `/api/tasks/${id}`, payload: {} })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
  })

  it('tipos errados → 400 (title numérico, completed texto, id não-numérico)', async () => {
    const badTitle = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 123 } })
    expect(badTitle.statusCode).toBe(400)

    const created = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x' } })
    const id = (created.json() as { id: number }).id
    const badCompleted = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      payload: { completed: 'yes' },
    })
    expect(badCompleted.statusCode).toBe(400)

    for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
      const res = await app.inject({
        method,
        url: '/api/tasks/abc',
        ...(method === 'PATCH' ? { payload: { title: 'x' } } : {}),
      })
      expect(res.statusCode).toBe(400)
    }
  })

  it('PATCH com position inválido → 400 (position -1, "x", 1.5)', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'x' } })
    const id = (created.json() as { id: number }).id
    for (const position of [-1, 'x', 1.5]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/tasks/${id}`,
        payload: { position },
      })
      expect(res.statusCode).toBe(400)
      expect((res.json() as { code: string }).code).toBe('VALIDATION_ERROR')
    }
  })

  it('erro inesperado → 500 padronizado INTERNAL_ERROR (simulado)', async () => {
    const boomService = {
      list: async (): Promise<never> => {
        throw new Error('boom simulado')
      },
    } as unknown as TaskService
    const boomApp = await buildApp({ db, taskService: boomService })
    try {
      const res = await boomApp.inject({ method: 'GET', url: '/api/tasks' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
    } finally {
      await boomApp.close()
    }
  })
})
