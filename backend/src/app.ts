import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import Fastify, { type FastifyContextConfig } from 'fastify'
import type { DataSource } from 'typeorm'
import { type ModuleOverrides, registerModules } from './container.js'
import { env } from './env.js'
import type { IActivityRepository } from './modules/activity/activity.repository.js'
import type { AppInstance } from './shared/http/app-instance.js'
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
}: BuildAppOptions): Promise<AppInstance> {
	const app = Fastify({
		logger: true,
		ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
		// Caddy é o único proxy em produção: trustProxy faz request.ip vir do
		// X-Forwarded-For, então o bucket do rate-limit é por IP real do cliente
		// (spec hardening-03, PR-03). Diretos sem proxy: ip = socket.
		trustProxy: true,
	}).withTypeProvider<TypeBoxTypeProvider>()
	// CSP ativa globalmente (PR-04). Isenção SÓ da superfície /api/docs: helmet
	// v13 suporta opções por rota via config.helmet — merged sobre a global
	// (contentSecurityPolicy:false remove apenas a CSP; demais headers ficam).
	app.addHook('onRoute', (routeOptions) => {
		if (
			typeof routeOptions.url === 'string' &&
			routeOptions.url.startsWith('/api/docs')
		) {
			routeOptions.config = {
				...(routeOptions.config as Record<string, unknown> | undefined),
				helmet: { contentSecurityPolicy: false },
			} as FastifyContextConfig
		}
	})
	await app.register(helmet)
	// CORS (PR-05): allowlist explícita via CORS_ORIGINS; unset → dev/test usa
	// `*`; em production sem allowlist o plugin NÃO é registrado (same-origin
	// via Caddy).
	const corsOrigins = env.corsOrigins
	if (corsOrigins !== undefined) {
		await app.register(cors, { origin: corsOrigins })
	} else if (env.nodeEnv !== 'production') {
		await app.register(cors)
	}
	// Swagger opt-in (PR-06): default ligado fora de production; compose de demo força "true"
	if (env.swaggerEnabled) {
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
	}
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
