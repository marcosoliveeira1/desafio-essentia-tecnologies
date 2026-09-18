import type { FastifyInstance } from 'fastify'
import type { LoginBody, RegisterBody } from './auth.schemas.js'
import { loginBodySchema, registerBodySchema } from './auth.schemas.js'
import type { AuthService } from './auth.service.js'

// Camada HTTP: registra rotas, valida via TypeBox, delega ao service.
// Erros (AppError ou validação) borbulham ao error-handler global.
// NÃO proteger rotas aqui (T18) — register/login são públicos.
export function registerAuthRoutes(app: FastifyInstance, service: AuthService): void {
  app.post('/api/auth/register', { schema: { body: registerBodySchema } }, async (request, reply) => {
    const user = await service.register(request.body as RegisterBody)
    return reply.status(201).send(user)
  })

  app.post('/api/auth/login', { schema: { body: loginBodySchema } }, async (request) => {
    return service.login(request.body as LoginBody)
  })
}
