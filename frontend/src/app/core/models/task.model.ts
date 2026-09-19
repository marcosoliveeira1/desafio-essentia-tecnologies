// Mirror of backend/src/shared/constants/limits.ts — keep both files in sync.
export const TITLE_MAX = 255
export const DESCRIPTION_MAX = 2000

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
