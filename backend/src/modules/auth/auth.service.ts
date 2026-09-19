import { ConflictError } from '../../shared/errors/conflict.error.js'
import { UnauthorizedError } from '../../shared/errors/unauthorized.error.js'
import { ValidationError } from '../../shared/errors/validation.error.js'
import type { UserEntity } from './user.entity.js'
import type { IUserRepository } from './user.repository.js'

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

export interface AuthPorts {
	hash(password: string): Promise<string>
	compare(password: string, passwordHash: string): Promise<boolean>
	signToken(payload: { sub: number }): string | Promise<string>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DUMMY_HASH =
	'$2b$10$WbftRaixW7tzaQ1QajsFh.ocp964OTXDDU/fkEtfT1X0sSbdrwSYi'

export function toPublicUser(user: UserEntity): PublicUser {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		createdAt: user.createdAt,
	}
}

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
			if (isDuplicateEntryError(err)) {
				throw new ConflictError('Email já cadastrado', 'EMAIL_CONFLICT')
			}
			throw err
		}
	}

	async login(input: LoginInput): Promise<{ token: string }> {
		const email = this.normalizeEmail(input?.email)
		const password = this.normalizeLoginPassword(input?.password)

		const user = await this.users.findByEmail(email)
		if (user === null) {
			await this.ports.compare(password, DUMMY_HASH)
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
			throw new ValidationError('Dados inválidos', [
				{ field: 'name', message: 'nome é obrigatório' },
			])
		}
		const name = value.trim()
		if (name.length === 0) {
			throw new ValidationError('Dados inválidos', [
				{ field: 'name', message: 'nome não pode ser vazio' },
			])
		}
		if (name.length > 120) {
			throw new ValidationError('Dados inválidos', [
				{ field: 'name', message: 'nome deve ter no máximo 120 caracteres' },
			])
		}
		return name
	}

	private normalizeEmail(value: unknown): string {
		if (typeof value !== 'string') {
			throw new ValidationError('E-mail é obrigatório.', [
				{ field: 'email', message: 'E-mail é obrigatório.' },
			])
		}
		const email = value.trim().toLowerCase()
		if (email.length === 0) {
			throw new ValidationError('E-mail é obrigatório.', [
				{ field: 'email', message: 'E-mail é obrigatório.' },
			])
		}
		if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
			throw new ValidationError('E-mail inválido. Corrija e tente novamente.', [
				{
					field: 'email',
					message: 'E-mail inválido. Corrija e tente novamente.',
				},
			])
		}
		return email
	}

	private normalizePassword(value: unknown): string {
		if (typeof value !== 'string' || value.length < 8) {
			throw new ValidationError('Dados inválidos', [
				{ field: 'password', message: 'senha deve ter no mínimo 8 caracteres' },
			])
		}
		if (value.length > 128) {
			throw new ValidationError('Dados inválidos', [
				{
					field: 'password',
					message: 'senha deve ter no máximo 128 caracteres',
				},
			])
		}
		return value
	}

	private normalizeLoginPassword(value: unknown): string {
		if (typeof value !== 'string' || value.length === 0) {
			throw new ValidationError('Dados inválidos', [
				{ field: 'password', message: 'senha é obrigatória' },
			])
		}
		return value
	}
}

function isDuplicateEntryError(err: unknown): boolean {
	if (err === null || typeof err !== 'object') {
		return false
	}
	const record = err as Record<string, unknown>
	return record.code === 'ER_DUP_ENTRY' || record.errno === 1062
}
