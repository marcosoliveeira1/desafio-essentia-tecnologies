import type { FastifyError, FastifyInstance } from 'fastify'
import { AppError } from '../errors/app-error.js'

interface ErrorBody {
	code: string
	message: string
	details?: unknown
}

export function registerErrorHandler(app: FastifyInstance): void {
	app.setErrorHandler(
		(rawError: FastifyError | AppError | Error, _request, reply) => {
			const maybeFastify = rawError as FastifyError
			if (
				typeof maybeFastify.statusCode === 'number' &&
				typeof maybeFastify.validation === 'object'
			) {
				const details = (
					maybeFastify.validation as Array<{
						instancePath?: string
						message?: string
					}>
				).map((v) => ({
					field:
						v.instancePath && v.instancePath !== ''
							? v.instancePath.replace(/^\//, '')
							: 'body',
					message: v.message ?? 'valor inválido',
				}))
				const body: ErrorBody = {
					code: 'VALIDATION_ERROR',
					message: 'Dados inválidos',
					details,
				}
				void reply.status(400).send(body)
				return
			}

			if (rawError instanceof AppError) {
				const body: ErrorBody = {
					code: rawError.code,
					message: rawError.message,
				}
				if (rawError.details !== undefined) {
					body.details = rawError.details
				}
				void reply.status(rawError.statusCode).send(body)
				return
			}

			const statusCode =
				typeof maybeFastify.statusCode === 'number' &&
				maybeFastify.statusCode >= 400
					? maybeFastify.statusCode
					: 500
			app.log.error(rawError)
			const body: ErrorBody = {
				code: 'INTERNAL_ERROR',
				message: 'Erro interno do servidor',
			}
			void reply.status(statusCode === 500 ? 500 : statusCode).send(body)
		},
	)

	app.setNotFoundHandler((_request, reply) => {
		void reply
			.status(404)
			.send({ code: 'NOT_FOUND', message: 'Rota não encontrada' })
	})
}
