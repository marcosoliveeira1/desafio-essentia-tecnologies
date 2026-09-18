import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify, { type FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { registerModules, type ModuleOverrides } from './container.js'
import { env } from './env.js'
import { registerErrorHandler } from './shared/http/error-handler.js'
import { registerHealthRoutes } from './shared/http/health.routes.js'

export interface BuildAppOptions {
  db: DataSource
  // Override p/ testes (ex.: simular falha de domínio sem derrubar o banco).
  taskService?: ModuleOverrides['taskService']
  authService?: ModuleOverrides['authService']
  // Override do secret p/ testes (e2e usa secret determinístico sem
  // depender de JWT_SECRET no shell).
  jwtSecret?: string
}

// Factory testável sem rede: não abre porta nem inicializa o banco.
// Quem chama decide o DataSource (dev/prod → todo_dev, e2e → todo_test).
export async function buildApp({ db, taskService, authService, jwtSecret }: BuildAppOptions): Promise<FastifyInstance> {
  // Ajv estrito: o default do Fastify coage tipos (123 → "123"), o que deixaria
  // "tipos errados" passarem com 201. Aqui, tipo errado é 400 (API-06).
  // removeAdditional: false — o default do Fastify (true) remove props extras
  // em silêncio; com false, o `additionalProperties: false` dos schemas vira 400.
  const app = Fastify({ logger: true, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } })
  // CORS aberto p/ dev (front em porta distinta via proxy ou direto).
  await app.register(cors)
  // T17: JWT ANTES de registerModules — o container injeta app.jwt.sign no AuthService.
  // NÃO proteger rotas ainda (T18) — register/login são públicos.
  await app.register(jwt, {
    secret: jwtSecret ?? env.auth.jwtSecret,
    sign: { expiresIn: env.auth.expiresIn },
  })
  registerErrorHandler(app)
  registerHealthRoutes(app, db)
  const overrides: ModuleOverrides | undefined =
    taskService !== undefined || authService !== undefined ? { taskService, authService } : undefined
  registerModules(app, db, overrides)
  return app
}
