import '@fastify/jwt'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/unauthorized.error.js'

declare module '@fastify/jwt' {
	interface FastifyJWT {
		payload: { sub: number }
		user: { sub: number }
	}
}

export async function requireAuth(
	request: FastifyRequest,
	_reply: FastifyReply,
): Promise<void> {
	try {
		await request.jwtVerify()
	} catch {
		throw new UnauthorizedError('Token ausente ou inválido')
	}
}
