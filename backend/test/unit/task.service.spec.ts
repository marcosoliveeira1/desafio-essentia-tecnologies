import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '../../src/shared/errors/not-found.error.js'
import { ValidationError } from '../../src/shared/errors/validation.error.js'
import { InMemoryTaskRepository } from '../../src/modules/tasks/in-memory-task.repository.js'
import { TaskService } from '../../src/modules/tasks/task.service.js'

describe('TaskService (unit, repo in-memory)', () => {
  let repo: InMemoryTaskRepository
  let service: TaskService

  beforeEach(() => {
    repo = new InMemoryTaskRepository()
    service = new TaskService(repo)
  })

  it('cria tarefa válida (completed nasce false)', async () => {
    const task = await service.create({ title: 'Estudar', description: 'Cap 3' })
    expect(task.id).toBeGreaterThan(0)
    expect(task.title).toBe('Estudar')
    expect(task.description).toBe('Cap 3')
    expect(task.completed).toBe(false)
    expect(task.createdAt).toBeInstanceOf(Date)
  })

  it('cria tarefa sem description (null)', async () => {
    const task = await service.create({ title: 'Só título' })
    expect(task.description).toBeNull()
  })

  it('cria com trim no title', async () => {
    const task = await service.create({ title: '  Comprar pão  ' })
    expect(task.title).toBe('Comprar pão')
  })

  it('rejeita título vazio (400)', async () => {
    await expect(service.create({ title: '' })).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
  })

  it('rejeita título whitespace-only F3 (400)', async () => {
    await expect(service.create({ title: '    ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(service.create({ title: '  \t\n ' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejeita título com mais de 255 chars (400)', async () => {
    await expect(service.create({ title: 'x'.repeat(256) })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejeita description com mais de 2000 chars (400)', async () => {
    await expect(service.create({ title: 'ok', description: 'y'.repeat(2001) })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('força completed=false mesmo quando o cliente envia true', async () => {
    const task = await service.create({ title: 'novo', completed: true })
    expect(task.completed).toBe(false)
  })

  it('getById retorna a tarefa (M1)', async () => {
    const created = await service.create({ title: 'buscar' })
    const found = await service.getById(created.id)
    expect(found.title).toBe('buscar')
  })

  it('getById de id inexistente → 404 TASK_NOT_FOUND', async () => {
    await expect(service.getById(999)).rejects.toMatchObject({ statusCode: 404, code: 'TASK_NOT_FOUND' })
  })

  it('getById de id inválido → 400', async () => {
    await expect(service.getById(0)).rejects.toBeInstanceOf(ValidationError)
    await expect(service.getById(Number.NaN)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('update parcial altera só o campo enviado', async () => {
    const created = await service.create({ title: 'orig', description: 'desc' })
    const updated = await service.update(created.id, { description: 'nova' })
    expect(updated.description).toBe('nova')
    expect(updated.title).toBe('orig')
    expect(updated.completed).toBe(false)
  })

  it('toggle de completed preserva os demais campos', async () => {
    const created = await service.create({ title: 't', description: 'd' })
    const done = await service.update(created.id, { completed: true })
    expect(done.completed).toBe(true)
    expect(done.title).toBe('t')
    expect(done.description).toBe('d')
    const undone = await service.update(created.id, { completed: false })
    expect(undone.completed).toBe(false)
  })

  it('update de id inexistente → 404', async () => {
    await expect(service.update(4242, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('update com body vazio → 400', async () => {
    const created = await service.create({ title: 'x' })
    await expect(service.update(created.id, {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('update rejeita title whitespace-only (400)', async () => {
    const created = await service.create({ title: 'x' })
    await expect(service.update(created.id, { title: '   ' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('update rejeita tipos errados (completed string → 400)', async () => {
    const created = await service.create({ title: 'x' })
    await expect(service.update(created.id, { completed: 'yes' as unknown as boolean })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('remove exclui e getById posterior dá 404', async () => {
    const created = await service.create({ title: 'bye' })
    await service.remove(created.id)
    await expect(service.getById(created.id)).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' })
  })

  it('remove de id inexistente → 404', async () => {
    await expect(service.remove(777)).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' })
  })

  it('list retorna em ordem crescente de position (desempate por id)', async () => {
    const a = await service.create({ title: 'a' })
    const b = await service.create({ title: 'b' })
    const c = await service.create({ title: 'c' })
    const list = await service.list()
    expect(list.map((t) => t.id)).toEqual([a.id, b.id, c.id])
    expect(list.map((t) => t.position)).toEqual([1, 2, 3])
  })

  it('create recebe max+1 global', async () => {
    const a = await service.create({ title: 'a' })
    const b = await service.create({ title: 'b' })
    expect(a.position).toBe(1)
    expect(b.position).toBe(2)
    await service.remove(a.id)
    const c = await service.create({ title: 'c' })
    expect(c.position).toBe(3)
  })

  it('create ignora position enviado pelo cliente', async () => {
    const task = await service.create({ title: 'x', position: 99 })
    expect(task.position).toBe(1)
    const other = await service.create({ title: 'y', position: 0 })
    expect(other.position).toBe(2)
  })

  it('list em position asc após PATCH de position', async () => {
    const a = await service.create({ title: 'a' })
    const b = await service.create({ title: 'b' })
    const c = await service.create({ title: 'c' })
    await service.update(c.id, { position: 0 })
    const list = await service.list()
    expect(list.map((t) => t.id)).toEqual([c.id, a.id, b.id])
  })

  it('PATCH position reordena a lista', async () => {
    const a = await service.create({ title: 'a' })
    const b = await service.create({ title: 'b' })
    await service.update(b.id, { position: 0 })
    const list = await service.list()
    expect(list.map((t) => t.id)).toEqual([b.id, a.id])
    expect(list[0].position).toBe(0)
  })

  it('update rejeita position negativo (400)', async () => {
    const created = await service.create({ title: 'x' })
    await expect(service.update(created.id, { position: -1 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('update rejeita position não-inteiro (400)', async () => {
    const created = await service.create({ title: 'x' })
    await expect(service.update(created.id, { position: 1.5 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    await expect(service.update(created.id, { position: 'x' as unknown as number })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })
})
