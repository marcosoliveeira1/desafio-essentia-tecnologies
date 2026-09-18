import '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/unauthorized.error.js'

// T18: module augmentation do @fastify/jwt — payload {sub: userId}.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number }
    user: { sub: number }
  }
}

// T18: guard de autenticação p/ as 6 rotas /api/tasks*.
// try jwtVerify / catch → UnauthorizedError('Token ausente ou inválido').
// Nunca vaza FST_JWT_* nem detalhes internos; nunca vira 500.
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError('Token ausente ou inválido')
  }
}
