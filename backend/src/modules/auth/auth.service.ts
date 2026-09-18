import { ConflictError } from '../../shared/errors/conflict.error.js'
import { UnauthorizedError } from '../../shared/errors/unauthorized.error.js'
import { ValidationError } from '../../shared/errors/validation.error.js'
import type { UserEntity } from './user.entity.js'
import type { IUserRepository } from './user.repository.js'

// Usuário público: SEMPRE sem passwordHash (nunca vaza p/ o cliente).
export interface PublicUser {
  id: number
  name: string
  email: string
  createdAt: Date
}

export interface RegisterInput {
  name: unknown
  email: unknown
  password: unknown
}

export interface LoginInput {
  email: unknown
  password: unknown
}

// PORTAS injetadas (DIP): o service é puro — não conhece bcrypt nem JWT.
// Produção: bcryptjs (hash/compare) + app.jwt.sign. Testes: fakes.
// signToken pode ser sync ou async (app.jwt.sign é sync).
export interface AuthPorts {
  hash(password: string): Promise<string>
  compare(password: string, passwordHash: string): Promise<boolean>
  signToken(payload: { sub: number }): string | Promise<string>
}

// F7: regex própria OBRIGATÓRIA — `format: email` do schema pode ser
// ignorado pelo Fastify sem ajv-formats, então o service revalida.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function toPublicUser(user: UserEntity): PublicUser {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }
}

// Regras de negócio do auth — não conhece HTTP nem SQL.
// Toda validação de domínio lança AppError (400/401/409); o error-handler monta o HTTP.
export class AuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly ports: AuthPorts,
  ) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const name = this.normalizeName(input?.name)
    const email = this.normalizeEmail(input?.email)
    const password = this.normalizePassword(input?.password)

    const existing = await this.users.findByEmail(email)
    if (existing !== null) {
      throw new ConflictError('Email já cadastrado', 'EMAIL_CONFLICT')
    }

    const passwordHash = await this.ports.hash(password)
    try {
      const created = await this.users.create({ name, email, passwordHash })
      return toPublicUser(created)
    } catch (err) {
      // Corrida: dois registers simultâneos passam no findByEmail e o
      // UNIQUE do MySQL barra o segundo (ER_DUP_ENTRY/1062) → 409, não 500.
      if (isDuplicateEntryError(err)) {
        throw new ConflictError('Email já cadastrado', 'EMAIL_CONFLICT')
      }
      throw err
    }
  }

  async login(input: LoginInput): Promise<{ token: string }> {
    const email = this.normalizeEmail(input?.email)
    // Login NÃO valida min 8: senha curta (não-vazia) → 401 genérico, não 400.
    const password = this.normalizeLoginPassword(input?.password)

    const user = await this.users.findByEmail(email)
    // Genérico de propósito: inexistente e senha errada retornam o
    // MESMO 401 (não vaza se o email existe — AUTH-02).
    if (user === null) {
      throw new UnauthorizedError('Credenciais inválidas')
    }
    const matches = await this.ports.compare(password, user.passwordHash)
    if (!matches) {
      throw new UnauthorizedError('Credenciais inválidas')
    }
    const token = await this.ports.signToken({ sub: user.id })
    return { token }
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ValidationError('Dados inválidos', [{ field: 'name', message: 'nome é obrigatório' }])
    }
    const name = value.trim()
    if (name.length === 0) {
      throw new ValidationError('Dados inválidos', [{ field: 'name', message: 'nome não pode ser vazio' }])
    }
    if (name.length > 120) {
      throw new ValidationError('Dados inválidos', [
        { field: 'name', message: 'nome deve ter no máximo 120 caracteres' },
      ])
    }
    return name
  }

  // Normaliza trim + lowercase ANTES de validar (login de "  FOO@x.com "
  // acha o usuário de "foo@x.com"; duplicado case-insensitive vira 409).
  private normalizeEmail(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ValidationError('Dados inválidos', [{ field: 'email', message: 'email é obrigatório' }])
    }
    const email = value.trim().toLowerCase()
    if (email.length === 0 || email.length > 255 || !EMAIL_PATTERN.test(email)) {
      throw new ValidationError('Dados inválidos', [{ field: 'email', message: 'email inválido' }])
    }
    return email
  }

  // F7: senha do register — 8..128 chars.
  private normalizePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 8) {
      throw new ValidationError('Dados inválidos', [
        { field: 'password', message: 'senha deve ter no mínimo 8 caracteres' },
      ])
    }
    if (value.length > 128) {
      throw new ValidationError('Dados inválidos', [
        { field: 'password', message: 'senha deve ter no máximo 128 caracteres' },
      ])
    }
    return value
  }

  // Login: só exige string não-vazia (curta → 401 no compare, não 400).
  private normalizeLoginPassword(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new ValidationError('Dados inválidos', [{ field: 'password', message: 'senha é obrigatória' }])
    }
    return value
  }
}

// MySQL: ER_DUP_ENTRY (errno 1062) no UNIQUE de users.email.
function isDuplicateEntryError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') {
    return false
  }
  const record = err as Record<string, unknown>
  return record['code'] === 'ER_DUP_ENTRY' || record['errno'] === 1062
}
