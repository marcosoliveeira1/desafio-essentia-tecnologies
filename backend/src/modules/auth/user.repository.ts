import type { UserEntity } from './user.entity.js'

export interface CreateUserInput {
	name: string
	email: string
	passwordHash: string
}

export interface IUserRepository {
	findByEmail(email: string): Promise<UserEntity | null>
	findById(id: number): Promise<UserEntity | null>
	create(data: CreateUserInput): Promise<UserEntity>
}
