import { NotFoundError } from '../../shared/errors/not-found.error.js'
import { TaskEntity } from './task.entity.js'
import type { CreateTaskInput, ITaskRepository, UpdateTaskInput } from './task.repository.js'

// Fake p/ unit tests do service (LSP: intercambiável com o TypeOrmTaskRepository).
// Sem banco, sem estado global — uma instância nova por teste.
export class InMemoryTaskRepository implements ITaskRepository {
  private readonly tasks = new Map<number, TaskEntity>()
  private seq = 1

  async findAll(): Promise<TaskEntity[]> {
    return [...this.tasks.values()].sort((a, b) => a.position - b.position || a.id - b.id)
  }

  async findById(id: number): Promise<TaskEntity | null> {
    return this.tasks.get(id) ?? null
  }

  async create(data: CreateTaskInput): Promise<TaskEntity> {
    const now = new Date()
    const task = Object.assign(new TaskEntity(), {
      id: this.seq++,
      title: data.title,
      description: data.description ?? null,
      completed: false,
      position: data.position ?? 0,
      createdAt: now,
      updatedAt: now,
    } satisfies Partial<TaskEntity>)
    this.tasks.set(task.id, task)
    return task
  }

  async update(id: number, data: UpdateTaskInput): Promise<TaskEntity | null> {
    const current = this.tasks.get(id)
    if (!current) {
      return null
    }
    const next = Object.assign(new TaskEntity(), {
      ...current,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.completed !== undefined ? { completed: data.completed } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      updatedAt: new Date(),
    })
    this.tasks.set(id, next)
    return next
  }

  async getMaxPosition(): Promise<number> {
    let max = 0
    for (const task of this.tasks.values()) {
      if (task.position > max) {
        max = task.position
      }
    }
    return max
  }

  async delete(id: number): Promise<boolean> {
    return this.tasks.delete(id)
  }

  // R1 two-phase: valida todos antes de mutar (atomicidade no fake).
  async updatePositions(orderedIds: number[], _userId?: number): Promise<TaskEntity[]> {
    const missingIds = orderedIds.filter((id) => !this.tasks.has(id))
    if (missingIds.length > 0) {
      throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', { missingIds })
    }
    const now = new Date()
    const result: TaskEntity[] = []
    for (let index = 0; index < orderedIds.length; index++) {
      const current = this.tasks.get(orderedIds[index]) as TaskEntity
      const next = Object.assign(new TaskEntity(), { ...current, position: index, updatedAt: now })
      this.tasks.set(next.id, next)
      result.push(next)
    }
    return result
  }
}
