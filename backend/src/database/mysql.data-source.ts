import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { type DbConfig, env } from '../env.js'
import { UserEntity } from '../modules/auth/user.entity.js'
import { TaskEntity } from '../modules/tasks/task.entity.js'
import { CreateTasksTable1789683319101 } from './migrations/1789683319101-CreateTasksTable.js'
import { AddPositionToTasks1789683319200 } from './migrations/1789683319200-AddPositionToTasks.js'
import { CreateUsersTable1789683319300 } from './migrations/1789683319300-CreateUsersTable.js'
import { AddUserIdToTasks1789683319400 } from './migrations/1789683319400-AddUserIdToTasks.js'

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

export const mysqlDataSource = createMysqlDataSource()
