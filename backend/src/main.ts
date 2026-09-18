import 'reflect-metadata'
import { buildApp } from './app.js'
import { createMongoDataSource } from './database/mongo.data-source.js'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'

async function main(): Promise<void> {
  const config = loadEnv()
  const db = createMysqlDataSource(config.db)
  await db.initialize()

  // T21: Mongo (extra Fase 6 — histórico) é OPCIONAL no boot: fora do ar,
  // só warn e o CRUD MySQL segue (degradação HIST-04; T22 registra com falha silenciosa).
  const mongo = createMongoDataSource(config.mongo.url)
  try {
    await mongo.initialize()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[main] mongo indisponível — histórico de atividades degradado:', err)
  }

  const app = await buildApp({ db })

  // M7: shutdown gracioso — SIGTERM fecha HTTP e depois os bancos, sem pendurar conexões.
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
  // eslint-disable-next-line no-console
  console.error('[main] falha fatal no boot:', err)
  process.exit(1)
})
