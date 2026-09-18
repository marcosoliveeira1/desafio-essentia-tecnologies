import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { TaskEntity } from '../modules/tasks/task.entity.js'
import { UserEntity } from '../modules/auth/user.entity.js'
import { env, type DbConfig } from '../env.js'
import { CreateTasksTable1789683319101 } from './migrations/1789683319101-CreateTasksTable.js'
import { AddPositionToTasks1789683319200 } from './migrations/1789683319200-AddPositionToTasks.js'
import { CreateUsersTable1789683319300 } from './migrations/1789683319300-CreateUsersTable.js'
import { AddUserIdToTasks1789683319400 } from './migrations/1789683319400-AddUserIdToTasks.js'

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
    entities: [TaskEntity, UserEntity],
    migrations: [
      CreateTasksTable1789683319101,
      AddPositionToTasks1789683319200,
      CreateUsersTable1789683319300,
      AddUserIdToTasks1789683319400,
    ],
    migrationsRun: true,
    synchronize: false,
    logging: false,
  })
}

// DataSource padrão (dev/prod). Testes criam o próprio via createMysqlDataSource(env.dbTest).
export const mysqlDataSource = createMysqlDataSource()
