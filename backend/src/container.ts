import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { registerTaskRoutes } from './modules/tasks/task.controller.js'
import type { TaskService } from './modules/tasks/task.service.js'
import { TaskService as TaskServiceImpl } from './modules/tasks/task.service.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'

import { TypeOrmUserRepository } from './modules/auth/typeorm-user.repository.js'
import type { IUserRepository } from './modules/auth/user.repository.js'

// COMPOSITION ROOT (DIP): cria implementações concretas e injeta nos services/controllers.
// `overrides` existe p/ testes (ex.: service fake que simula 500 no e2e de edge).
export function createTaskService(db: DataSource): TaskService {
  return new TaskServiceImpl(new TypeOrmTaskRepository(db))
}

// T16: factory do repository de usuários (service/rotas auth chegam em T17).
// NÃO registrar rotas auth aqui — só a factory.
export function createUserRepository(db: DataSource): IUserRepository {
  return new TypeOrmUserRepository(db)
}

export function registerModules(
  app: FastifyInstance,
  db: DataSource,
  overrides?: { taskService?: TaskService },
): TaskService {
  const taskService = overrides?.taskService ?? createTaskService(db)
  registerTaskRoutes(app, taskService)
  return taskService
}
