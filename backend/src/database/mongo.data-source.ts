import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { ActivityLogEntity } from '../modules/activity/activity-log.entity.js'
import { env } from '../env.js'

// T21: segundo DataSource (MongoDB, driver `mongodb` — NÃO mongoose).
// O database sai da própria URL (fallback `todo_activity`); o Mongo cria
// a coleção `task_activity` no primeiro write, então sem migrations/sync.
export function createMongoDataSource(url?: string): DataSource {
  const mongoUrl = url ?? env.mongo.url
  const database = new URL(mongoUrl).pathname.replace(/^\//, '') || undefined
  return new DataSource({
    type: 'mongodb',
    url: mongoUrl,
    ...(database !== undefined ? { database } : {}),
    entities: [ActivityLogEntity],
    synchronize: false,
    logging: false,
  })
}

// DataSource padrão (dev/prod). O boot (main.ts) o inicializa em try/catch:
// mongo fora NÃO impede o boot do MySQL (degradação HIST-04, registrada em T22).
export const mongoDataSource = createMongoDataSource()
