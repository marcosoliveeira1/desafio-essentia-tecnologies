import { NotFoundError } from '../../shared/errors/not-found.error.js'
import { ValidationError } from '../../shared/errors/validation.error.js'
import type { TaskEntity } from './task.entity.js'
import type { CreateTaskInput, ITaskRepository, UpdateTaskInput } from './task.repository.js'

// Regras de negócio de tarefas — não conhece HTTP nem SQL.
// Toda validação de domínio lança AppError (400/404); o error-handler monta o HTTP.
// T18 (breaking intencional): userId OBRIGATÓRIO como primeiro arg em toda chamada.
// Cross-user → NotFoundError TASK_NOT_FOUND 404 (não vaza existência alheia).
export class TaskService {
  constructor(private readonly repo: ITaskRepository) {}

  // Ordem crescente de position (o repositório garante; desempate por id).
  list(userId: number): Promise<TaskEntity[]> {
    return this.repo.findAll(userId)
  }

  async getById(userId: number, id: number): Promise<TaskEntity> {
    this.assertValidId(id)
    const task = await this.repo.findById(id, userId)
    if (task === null) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND')
    }
    return task
  }

  async create(userId: number, input: CreateTaskInput): Promise<TaskEntity> {
    const title = this.normalizeTitle(input?.title)
    const description = this.normalizeDescription(input?.description)
    // `completed` sempre nasce false, mesmo que o cliente envie true.
    // `position` é sempre MAX+1 do DONO (input do cliente ignorado).
    const maxPosition = await this.repo.getMaxPosition(userId)
    return this.repo.create({ title, description, completed: false, position: maxPosition + 1 }, userId)
  }

  async update(userId: number, id: number, patch: UpdateTaskInput): Promise<TaskEntity> {
    this.assertValidId(id)
    if (patch === null || typeof patch !== 'object' || Object.keys(patch).length === 0) {
      throw new ValidationError('Corpo da requisição vazio', [{ field: 'body', message: 'envie ao menos um campo' }])
    }
    const data: UpdateTaskInput = {}
    if (patch.title !== undefined) {
      data.title = this.normalizeTitle(patch.title)
    }
    if (patch.description !== undefined) {
      data.description = this.normalizeDescription(patch.description)
    }
    if (patch.completed !== undefined) {
      if (typeof patch.completed !== 'boolean') {
        throw new ValidationError('Dados inválidos', [{ field: 'completed', message: 'deve ser booleano' }])
      }
      data.completed = patch.completed
    }
    if (patch.position !== undefined) {
      if (!Number.isInteger(patch.position) || (patch.position as number) < 0) {
        throw new ValidationError('Dados inválidos', [
          { field: 'position', message: 'deve ser um inteiro maior ou igual a 0' },
        ])
      }
      data.position = patch.position
    }
    const existing = await this.repo.findById(id, userId)
    if (existing === null) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND')
    }
    const updated = await this.repo.update(id, data, userId)
    if (updated === null) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND')
    }
    return updated
  }

  async remove(userId: number, id: number): Promise<void> {
    this.assertValidId(id)
    const deleted = await this.repo.delete(id, userId)
    if (!deleted) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND')
    }
  }

  // R1: reorder — position = índice 0-based; não-listadas mantêm position.
  // Guards 400 (vazio/duplicado/não-inteiro/<1) + 404 (id inexistente OU de outro
  // dono, details {missingIds}). Sem evento de histórico. Retorna na ordem do input.
  async reorder(userId: number, ids: unknown): Promise<TaskEntity[]> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('Dados inválidos', [
        { field: 'ids', message: 'deve ser um array não-vazio' },
      ])
    }
    for (const id of ids) {
      if (!Number.isInteger(id) || (id as number) < 1) {
        throw new ValidationError('Dados inválidos', [
          { field: 'ids', message: 'deve conter apenas inteiros positivos' },
        ])
      }
    }
    const orderedIds = ids as number[]
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ValidationError('Dados inválidos', [
        { field: 'ids', message: 'não deve conter ids duplicados' },
      ])
    }
    const all = await this.repo.findAll(userId)
    const existing = new Set(all.map((t) => t.id))
    const missingIds = orderedIds.filter((id) => !existing.has(id))
    if (missingIds.length > 0) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', { missingIds })
    }
    return this.repo.updatePositions(orderedIds, userId)
  }

  private assertValidId(id: number): void {
    if (!Number.isInteger(id) || id < 1) {
      throw new ValidationError('Dados inválidos', [{ field: 'id', message: 'deve ser um inteiro positivo' }])
    }
  }

  // F3: trim + rejeita vazio pós-trim (whitespace-only) + limite 255.
  private normalizeTitle(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ValidationError('Dados inválidos', [{ field: 'title', message: 'título é obrigatório' }])
    }
    const title = value.trim()
    if (title.length === 0) {
      throw new ValidationError('Dados inválidos', [{ field: 'title', message: 'título não pode ser vazio' }])
    }
    if (title.length > 255) {
      throw new ValidationError('Dados inválidos', [
        { field: 'title', message: 'título deve ter no máximo 255 caracteres' },
      ])
    }
    return title
  }

  private normalizeDescription(value: unknown): string | null | undefined {
    if (value === undefined || value === null) {
      return value ?? undefined
    }
    if (typeof value !== 'string') {
      throw new ValidationError('Dados inválidos', [{ field: 'description', message: 'deve ser texto' }])
    }
    if (value.length > 2000) {
      throw new ValidationError('Dados inválidos', [
        { field: 'description', message: 'descrição deve ter no máximo 2000 caracteres' },
      ])
    }
    return value
  }
}
