import type { FastifyInstance } from 'fastify'
import { env } from '../../env.js'
import type { LoginBody, RegisterBody } from './auth.schemas.js'
import { loginBodySchema, registerBodySchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

const rateLimitConfig = {
	max: env.rateLimit.max,
	timeWindow: env.rateLimit.windowMs,
}

export function registerAuthRoutes(
	app: FastifyInstance,
	service: AuthService,
): void {
	app.post(
		'/api/auth/register',
		{
			config: { rateLimit: rateLimitConfig },
			schema: { body: registerBodySchema },
		},
		async (request, reply) => {
			const user = await service.register(request.body as RegisterBody)
			return reply.status(201).send(user)
		},
	)

	app.post(
		'/api/auth/login',
		{
			config: { rateLimit: rateLimitConfig },
			schema: { body: loginBodySchema },
		},
		async (request) => {
			return service.login(request.body as LoginBody)
		},
	)
}
