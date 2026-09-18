import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { TaskEntity } from '../modules/tasks/task.entity.js'
import { env, type DbConfig } from '../env.js'
import { CreateTasksTable1789683319101 } from './migrations/1789683319101-CreateTasksTable.js'
import { AddPositionToTasks1789683319200 } from './migrations/1789683319200-AddPositionToTasks.js'

// F8: `migrationsRun: true` — schema versionado roda no boot, zero passo manual.
// Entidades/migrations entram nas próximas tasks (T4...).
export function createMysqlDataSource(config?: DbConfig): DataSource {
  const db: DbConfig = config ?? env.db
  return new DataSource({
    type: 'mysql',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: [TaskEntity],
    migrations: [CreateTasksTable1789683319101, AddPositionToTasks1789683319200],
    migrationsRun: true,
    synchronize: false,
    logging: false,
  })
}

// DataSource padrão (dev/prod). Testes criam o próprio via createMysqlDataSource(env.dbTest).
export const mysqlDataSource = createMysqlDataSource()
