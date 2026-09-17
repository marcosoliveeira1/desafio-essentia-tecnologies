import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { registerModules } from './container.js'
import type { TaskService } from './modules/tasks/task.service.js'
import { registerErrorHandler } from './shared/http/error-handler.js'
import { registerHealthRoutes } from './shared/http/health.routes.js'

export interface BuildAppOptions {
  db: DataSource
  // Override p/ testes (ex.: simular falha de domínio sem derrubar o banco).
  taskService?: TaskService
}

// Factory testável sem rede: não abre porta nem inicializa o banco.
// Quem chama decide o DataSource (dev/prod → todo_dev, e2e → todo_test).
export async function buildApp({ db, taskService }: BuildAppOptions): Promise<FastifyInstance> {
  // Ajv estrito: o default do Fastify coage tipos (123 → "123"), o que deixaria
  // "tipos errados" passarem com 201. Aqui, tipo errado é 400 (API-06).
  const app = Fastify({ logger: true, ajv: { customOptions: { coerceTypes: false } } })
  // CORS aberto p/ dev (front em porta distinta via proxy ou direto).
  await app.register(cors)
  registerErrorHandler(app)
  registerHealthRoutes(app, db)
  registerModules(app, db, taskService ? { taskService } : undefined)
  return app
}
