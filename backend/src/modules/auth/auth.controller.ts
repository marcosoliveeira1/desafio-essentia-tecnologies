import { env } from '../../env.js'
import type { AppInstance } from '../../shared/http/app-instance.js'
import { loginBodySchema, registerBodySchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

const rateLimitConfig = {
	max: env.rateLimit.max,
	timeWindow: env.rateLimit.windowMs,
}

export function registerAuthRoutes(
	app: AppInstance,
	service: AuthService,
): void {
	app.post(
		'/api/auth/register',
		{
			config: { rateLimit: rateLimitConfig },
			schema: { body: registerBodySchema },
		},
		async (request, reply) => {
			const user = await service.register(request.body)
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
			return service.login(request.body)
		},
	)
}
