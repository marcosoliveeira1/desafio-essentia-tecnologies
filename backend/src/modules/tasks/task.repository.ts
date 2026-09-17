import type { TaskEntity } from './task.entity.js'

// DTOs de entrada do módulo tasks (camada de domínio — sem HTTP, sem SQL).
export interface CreateTaskInput {
  title: string
  description?: string | null
  completed?: boolean
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  completed?: boolean
}

// PORTA (DIP): o service depende só desta interface.
// Implementações: TypeOrmTaskRepository (MySQL) e InMemoryTaskRepository (unit tests).
// `userId` é opcional até a Fase 5 (T18), quando o escopo por usuário entra.
export interface ITaskRepository {
  findAll(userId?: number): Promise<TaskEntity[]>
  findById(id: number, userId?: number): Promise<TaskEntity | null>
  create(data: CreateTaskInput, userId?: number): Promise<TaskEntity>
  update(id: number, data: UpdateTaskInput, userId?: number): Promise<TaskEntity | null>
  delete(id: number, userId?: number): Promise<boolean>
}
