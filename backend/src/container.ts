import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { AuthService } from './modules/auth/auth.service.js'
import { registerAuthRoutes } from './modules/auth/auth.controller.js'
import { registerTaskRoutes } from './modules/tasks/task.controller.js'
import type { TaskService } from './modules/tasks/task.service.js'
import { TaskService as TaskServiceImpl } from './modules/tasks/task.service.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'

import { TypeOrmUserRepository } from './modules/auth/typeorm-user.repository.js'
import type { IUserRepository } from './modules/auth/user.repository.js'
import type { IActivityRepository } from './modules/activity/activity.repository.js'
import { registerHistoryRoutes } from './modules/activity/history.controller.js'
import { MongoActivityRepository } from './modules/activity/mongo-activity.repository.js'

// COMPOSITION ROOT (DIP): cria implementações concretas e injeta nos services/controllers.
// `overrides` existe p/ testes (ex.: service fake que simula 500 no e2e de edge).
// T22: `activity` opcional injeta eventos no TaskService + alimenta history.controller;
// sem mongo (undefined) o CRUD segue sem histórico (degradação HIST-04).
export function createTaskService(db: DataSource, activity?: IActivityRepository): TaskService {
  return new TaskServiceImpl(new TypeOrmTaskRepository(db), activity)
}

// T16: factory do repository de usuários (service/rotas auth chegam em T17).
// NÃO registrar rotas auth aqui — só a factory.
export function createUserRepository(db: DataSource): IUserRepository {
  return new TypeOrmUserRepository(db)
}

// T17: factory do AuthService — portas reais (bcryptjs + sign do @fastify/jwt).
// `signToken` chega do app (p/ testes, qualquer função serve).
export function createAuthService(
  db: DataSource,
  signToken: (payload: { sub: number }) => string | Promise<string>,
): AuthService {
  return new AuthService(createUserRepository(db), {
    hash: (password: string) => bcrypt.hash(password, 10),
    compare: (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash),
    signToken,
  })
}

// T21: factory do repository de atividades (MongoDB, extra Fase 6).
// T22: injetado no TaskService (eventos) + history.controller (leituras).
export function createActivityRepository(mongo: DataSource): IActivityRepository {
  return new MongoActivityRepository(mongo)
}

export interface ModuleOverrides {
  taskService?: TaskService
  authService?: AuthService
}

export function registerModules(
  app: FastifyInstance,
  db: DataSource,
  overrides?: ModuleOverrides,
  activityRepository?: IActivityRepository,
): TaskService {
  const taskService = overrides?.taskService ?? createTaskService(db, activityRepository)
  // signToken via app.jwt.sign — o plugin @fastify/jwt É registrado no buildApp ANTES daqui.
  const authService = overrides?.authService ?? createAuthService(db, (payload) => app.jwt.sign(payload))
  registerTaskRoutes(app, taskService)
  registerAuthRoutes(app, authService)
  // T22: history compartilha o taskService (escopo do dono) + o activity opcional.
  // Com override de taskService (ex.: boom fake), o history usa o mesmo fake.
  registerHistoryRoutes(app, taskService, activityRepository)
  return taskService
}
