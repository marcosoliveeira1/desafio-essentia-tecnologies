import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'

export function registerHealthRoutes(
	app: FastifyInstance,
	db: DataSource,
): void {
	app.get('/health', async (_request, reply) => {
		try {
			await db.query('SELECT 1')
		} catch (err) {
			app.log.error(err)
			return reply.status(503).send({
				code: 'DB_UNAVAILABLE',
				message: 'Banco de dados indisponível',
			})
		}
		return reply.status(200).send({ status: 'ok', db: 'up' })
	})
}
