import type { DataSource, Repository } from 'typeorm'
import { UserEntity } from './user.entity.js'
import type { CreateUserInput, IUserRepository } from './user.repository.js'

// ADAPTADOR MySQL da porta IUserRepository — único lugar com SQL/TypeORM
// no módulo auth (service/controller nunca tocam no banco direto).
// Espelha TypeOrmTaskRepository: constructor(db) + getRepository.
export class TypeOrmUserRepository implements IUserRepository {
  private readonly orm: Repository<UserEntity>
  private readonly db: DataSource

  constructor(db: DataSource) {
    this.db = db
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
