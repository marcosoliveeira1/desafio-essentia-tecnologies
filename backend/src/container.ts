import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { DataSource } from 'typeorm'
import type { IActivityRepository } from './modules/activity/activity.repository.js'
import { registerHistoryRoutes } from './modules/activity/history.controller.js'
import { MongoActivityRepository } from './modules/activity/mongo-activity.repository.js'
import { registerAuthRoutes } from './modules/auth/auth.controller.js'
import { AuthService } from './modules/auth/auth.service.js'
import { TypeOrmUserRepository } from './modules/auth/typeorm-user.repository.js'
import type { IUserRepository } from './modules/auth/user.repository.js'
import { registerTaskRoutes } from './modules/tasks/task.controller.js'
import type { TaskService } from './modules/tasks/task.service.js'
import { TaskService as TaskServiceImpl } from './modules/tasks/task.service.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'

export function createTaskService(
	db: DataSource,
	activity?: IActivityRepository,
): TaskService {
	return new TaskServiceImpl(new TypeOrmTaskRepository(db), activity)
}

export function createUserRepository(db: DataSource): IUserRepository {
	return new TypeOrmUserRepository(db)
}

export function createAuthService(
	db: DataSource,
	signToken: (payload: { sub: number }) => string | Promise<string>,
): AuthService {
	return new AuthService(createUserRepository(db), {
		hash: (password: string) => bcrypt.hash(password, 10),
		compare: (password: string, passwordHash: string) =>
			bcrypt.compare(password, passwordHash),
		signToken,
	})
}

export function createActivityRepository(
	mongo: DataSource,
): IActivityRepository {
	return new MongoActivityRepository(mongo)
}

export interface ModuleOverrides {
	taskService?: TaskService
	authService?: AuthService
}

export function registerModules(
	app: FastifyInstance,
	db: DataSource,
	overrides?: ModuleOverrides,
	activityRepository?: IActivityRepository,
): TaskService {
	const taskService =
		overrides?.taskService ?? createTaskService(db, activityRepository)
	const authService =
		overrides?.authService ??
		createAuthService(db, (payload) => app.jwt.sign(payload))
	registerTaskRoutes(app, taskService)
	registerAuthRoutes(app, authService)
	registerHistoryRoutes(app, taskService, activityRepository)
	return taskService
}
