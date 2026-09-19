import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
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
	await app.register(jwt, {
		secret: jwtSecret ?? env.auth.jwtSecret,
		sign: { expiresIn: env.auth.expiresIn },
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
