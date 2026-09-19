import type { DataSource, Repository } from 'typeorm'
import { UserEntity } from './user.entity.js'
import type { CreateUserInput, IUserRepository } from './user.repository.js'

export class TypeOrmUserRepository implements IUserRepository {
	private readonly orm: Repository<UserEntity>

	constructor(db: DataSource) {
		this.orm = db.getRepository(UserEntity)
	}

	findByEmail(email: string): Promise<UserEntity | null> {
		return this.orm.findOneBy({ email })
	}

	findById(id: number): Promise<UserEntity | null> {
		return this.orm.findOneBy({ id })
	}

	async create(data: CreateUserInput): Promise<UserEntity> {
		const user = this.orm.create({
			name: data.name,
			email: data.email,
			passwordHash: data.passwordHash,
		})
		return this.orm.save(user)
	}
}
