import type { UserEntity } from './user.entity.js'

// DTO de entrada do módulo auth (camada de domínio — sem HTTP, sem SQL).
// Hash bcrypt chega pronto via T17; o repository só persiste.
export interface CreateUserInput {
  name: string
  email: string
  passwordHash: string
}

// PORTA (DIP): o service (T17) depende só desta interface.
// Implementação: TypeOrmUserRepository (MySQL).
export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>
  findById(id: number): Promise<UserEntity | null>
  create(data: CreateUserInput): Promise<UserEntity>
}
