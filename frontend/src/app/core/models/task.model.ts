export interface Task {
	id: number
	title: string
	description: string | null
	completed: boolean
	position: number
	createdAt: string
	updatedAt: string
}

export interface CreateTaskDto {
	title: string
	description?: string | null
}

export interface UpdateTaskDto {
	title?: string
	description?: string | null
	completed?: boolean
	position?: number
}
