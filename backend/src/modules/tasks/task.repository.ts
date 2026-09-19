import type { TaskEntity } from './task.entity.js'

export interface CreateTaskInput {
	title: string
	description?: string | null
	completed?: boolean
	position?: number
}

export interface UpdateTaskInput {
	title?: string
	description?: string | null
	completed?: boolean
	position?: number
}

export interface ITaskRepository {
	findAll(userId?: number): Promise<TaskEntity[]>
	findById(id: number, userId?: number): Promise<TaskEntity | null>
	create(data: CreateTaskInput, userId?: number): Promise<TaskEntity>
	update(
		id: number,
		data: UpdateTaskInput,
		userId?: number,
	): Promise<TaskEntity | null>
	delete(id: number, userId?: number): Promise<boolean>
	getMaxPosition(userId?: number): Promise<number>
	updatePositions(orderedIds: number[], userId?: number): Promise<TaskEntity[]>
}
