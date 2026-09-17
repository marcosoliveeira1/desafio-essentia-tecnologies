import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { registerErrorHandler } from './shared/http/error-handler.js'
import { registerHealthRoutes } from './shared/http/health.routes.js'

export interface BuildAppOptions {
  db: DataSource
}

// Factory testável sem rede: não abre porta nem inicializa o banco.
// Quem chama decide o DataSource (dev/prod → todo_dev, e2e → todo_test).
export async function buildApp({ db }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })
  await app.register(cors)
  registerErrorHandler(app)
  registerHealthRoutes(app, db)
  return app
}
