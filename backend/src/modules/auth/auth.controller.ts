import type { FastifyInstance } from 'fastify'
import type { LoginBody, RegisterBody } from './auth.schemas.js'
import { loginBodySchema, registerBodySchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

export function registerAuthRoutes(
	app: FastifyInstance,
	service: AuthService,
): void {
	app.post(
		'/api/auth/register',
		{ schema: { body: registerBodySchema } },
		async (request, reply) => {
			const user = await service.register(request.body as RegisterBody)
			return reply.status(201).send(user)
		},
	)

	app.post(
		'/api/auth/login',
		{ schema: { body: loginBodySchema } },
		async (request) => {
			return service.login(request.body as LoginBody)
		},
	)
}
