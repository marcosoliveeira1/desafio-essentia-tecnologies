import 'reflect-metadata'
import { buildApp } from './app.js'
import { createActivityRepository } from './container.js'
import {
	createMongoDataSource,
	ensureActivityIndexes,
} from './database/mongo.data-source.js'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'
import { runSeed } from './seed.js'

async function main(): Promise<void> {
	const config = loadEnv()
	const db = createMysqlDataSource(config.db)
	await db.initialize()

	try {
		await runSeed(db)
	} catch (err) {
		console.warn('[main] seed demo falhou — seguindo sem dados demo:', err)
	}

	const mongo = createMongoDataSource(config.mongo.url)
	try {
		await mongo.initialize()
		try {
			await ensureActivityIndexes(mongo)
		} catch (err) {
			console.warn(
				'[main] indexes mongo não criados — seguindo sem indexes:',
				err,
			)
		}
	} catch (err) {
		console.warn(
			'[main] mongo indisponível — histórico de atividades degradado:',
			err,
		)
	}

	const app = await buildApp({
		db,
		activityRepository: mongo.isInitialized
			? createActivityRepository(mongo)
			: undefined,
	})

	const shutdown = async (signal: string): Promise<void> => {
		app.log.info({ signal }, 'encerrando servidor')
		await app.close()
		if (db.isInitialized) {
			await db.destroy()
		}
		if (mongo.isInitialized) {
			await mongo.destroy()
		}
	}
	process.on('SIGTERM', () => void shutdown('SIGTERM'))
	process.on('SIGINT', () => void shutdown('SIGINT'))

	await app.listen({ host: config.host, port: config.port })
}

void main().catch((err: unknown) => {
	console.error('[main] falha fatal no boot:', err)
	process.exit(1)
})
