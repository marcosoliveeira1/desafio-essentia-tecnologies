import 'reflect-metadata'
import { buildApp } from './app.js'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'

async function main(): Promise<void> {
  const config = loadEnv()
  const db = createMysqlDataSource(config.db)
  await db.initialize()

  const app = await buildApp({ db })

  // M7: shutdown gracioso — SIGTERM fecha HTTP e depois o banco, sem pendurar conexões.
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'encerrando servidor')
    await app.close()
    if (db.isInitialized) {
      await db.destroy()
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
