import type { FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/unauthorized.error.js'

export function currentUserId(request: FastifyRequest): number {
	const sub = request.user?.sub
	if (typeof sub !== 'number' || !Number.isInteger(sub)) {
		throw new UnauthorizedError('Token ausente ou inválido')
	}
	return sub
}
