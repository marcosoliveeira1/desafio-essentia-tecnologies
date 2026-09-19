import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import { type ModuleOverrides, registerModules } from './container.js'
import { env } from './env.js'
import type { IActivityRepository } from './modules/activity/activity.repository.js'
import { registerErrorHandler } from './shared/http/error-handler.js'
import { registerHealthRoutes } from './shared/http/health.routes.js'

export interface BuildAppOptions {
	db: DataSource
	taskService?: ModuleOverrides['taskService']
	authService?: ModuleOverrides['authService']
	jwtSecret?: string
	activityRepository?: IActivityRepository
}

export async function buildApp({
	db,
	taskService,
	authService,
	jwtSecret,
	activityRepository,
}: BuildAppOptions): Promise<FastifyInstance> {
	const app = Fastify({
		logger: true,
		ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
	})
	await app.register(cors)
	// contentSecurityPolicy desligado: a CSP default do helmet quebra o Swagger UI
	// servido em /api/docs; os demais headers de segurança seguem ativos (spec
	// hardening-01, edge case de H3).
	await app.register(helmet, { contentSecurityPolicy: false })
	await app.register(swagger, {
		openapi: {
			info: {
				title: 'Essentia Todo List — API',
				description:
					'API do gerenciador de tarefas Essentia: autenticação JWT, CRUD de tarefas e histórico de atividades.',
				version: '0.1.0',
			},
		},
	})
	await app.register(swaggerUi, {
		routePrefix: '/api/docs',
	})
	await app.register(jwt, {
		secret: jwtSecret ?? env.auth.jwtSecret,
		sign: { expiresIn: env.auth.expiresIn },
	})
	await app.register(rateLimit, {
		global: false,
		max: env.rateLimit.max,
		timeWindow: env.rateLimit.windowMs,
		allowList: env.rateLimit.allowlist,
	})
	registerErrorHandler(app)
	registerHealthRoutes(app, db)
	const overrides: ModuleOverrides | undefined =
		taskService !== undefined || authService !== undefined
			? { taskService, authService }
			: undefined
	registerModules(app, db, overrides, activityRepository)
	return app
}
