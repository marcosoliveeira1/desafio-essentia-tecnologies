import { TaskEntity } from './task.entity.js'
import type { CreateTaskInput, ITaskRepository, UpdateTaskInput } from './task.repository.js'

// Fake p/ unit tests do service (LSP: intercambiável com o TypeOrmTaskRepository).
// Sem banco, sem estado global — uma instância nova por teste.
export class InMemoryTaskRepository implements ITaskRepository {
  private readonly tasks = new Map<number, TaskEntity>()
  private seq = 1

  async findAll(): Promise<TaskEntity[]> {
    return [...this.tasks.values()].sort((a, b) => b.id - a.id)
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
      updatedAt: new Date(),
    })
    this.tasks.set(id, next)
    return next
  }

  async delete(id: number): Promise<boolean> {
    return this.tasks.delete(id)
  }
}
