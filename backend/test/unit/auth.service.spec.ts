import { beforeEach, describe, expect, it } from 'vitest'
import {
	type AuthPorts,
	AuthService,
	toPublicUser,
} from '../../src/modules/auth/auth.service.js'
import { UserEntity } from '../../src/modules/auth/user.entity.js'
import type {
	CreateUserInput,
	IUserRepository,
} from '../../src/modules/auth/user.repository.js'
import { ConflictError } from '../../src/shared/errors/conflict.error.js'
import { UnauthorizedError } from '../../src/shared/errors/unauthorized.error.js'
import { ValidationError } from '../../src/shared/errors/validation.error.js'

class InMemoryUserRepository implements IUserRepository {
	private readonly users = new Map<number, UserEntity>()
	private seq = 1
	failNextCreateAsDuplicate = false

	async findByEmail(email: string): Promise<UserEntity | null> {
		for (const user of this.users.values()) {
			if (user.email === email) {
				return user
			}
		}
		return null
	}

	async findById(id: number): Promise<UserEntity | null> {
		return this.users.get(id) ?? null
	}

	async create(data: CreateUserInput): Promise<UserEntity> {
		if (this.failNextCreateAsDuplicate) {
			this.failNextCreateAsDuplicate = false
			throw Object.assign(
				new Error("Duplicate entry 'x' for key 'users.email'"),
				{
					code: 'ER_DUP_ENTRY',
					errno: 1062,
				},
			)
		}
		const user = Object.assign(new UserEntity(), {
			id: this.seq++,
			name: data.name,
			email: data.email,
			passwordHash: data.passwordHash,
			createdAt: new Date(),
		} satisfies Partial<UserEntity>)
		this.users.set(user.id, user)
		return user
	}
}

function testPorts(): AuthPorts & { signed: Array<{ sub: number }> } {
	const signed: Array<{ sub: number }> = []
	return {
		signed,
		hash: async (password: string) => `hash:${password}`,
		compare: async (password: string, passwordHash: string) =>
			passwordHash === `hash:${password}`,
		signToken: (payload: { sub: number }) => {
			signed.push(payload)
			return `token-for-${payload.sub}`
		},
	}
}

describe('AuthService (unit, repo in-memory)', () => {
	let repo: InMemoryUserRepository
	let ports: ReturnType<typeof testPorts>
	let service: AuthService

	beforeEach(() => {
		repo = new InMemoryUserRepository()
		ports = testPorts()
		service = new AuthService(repo, ports)
	})

	it('register aplica hash e retorna usuário público sem passwordHash', async () => {
		const user = await service.register({
			name: 'Ada',
			email: 'Ada@TechX.com ',
			password: 'segredo12',
		})
		expect(user.id).toBeGreaterThan(0)
		expect(user.name).toBe('Ada')
		expect(user.email).toBe('ada@techx.com')
		expect(user.createdAt).toBeInstanceOf(Date)
		expect(user).not.toHaveProperty('passwordHash')

		const stored = await repo.findByEmail('ada@techx.com')
		expect(stored?.passwordHash).toBe('hash:segredo12')
	})

	it('register com email duplicado (mesmo case diferente) → 409 EMAIL_CONFLICT', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@techx.com',
			password: 'segredo12',
		})
		await expect(
			service.register({
				name: 'Outra',
				email: 'ADA@techx.com',
				password: 'outra1234',
			}),
		).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_CONFLICT' })
		await expect(
			service.register({
				name: 'Outra',
				email: 'ada@techx.com',
				password: 'outra1234',
			}),
		).rejects.toBeInstanceOf(ConflictError)
	})

	it('register converte ER_DUP_ENTRY (race no UNIQUE) em 409 EMAIL_CONFLICT', async () => {
		repo.failNextCreateAsDuplicate = true
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@techx.com',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_CONFLICT' })
	})

	it('login ok retorna {token} com sub = userId', async () => {
		const created = await service.register({
			name: 'Ada',
			email: 'ada@techx.com',
			password: 'segredo12',
		})
		const result = await service.login({
			email: ' ada@techx.com',
			password: 'segredo12',
		})
		expect(result).toEqual({ token: `token-for-${created.id}` })
		expect(ports.signed).toEqual([{ sub: created.id }])
	})

	it('login com email inexistente e com senha errada dão o MESMO 401 genérico', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@techx.com',
			password: 'segredo12',
		})
		const missing = await service
			.login({ email: 'ninguem@techx.com', password: 'segredo12' })
			.catch((e) => e)
		const wrong = await service
			.login({ email: 'ada@techx.com', password: 'errada123' })
			.catch((e) => e)
		for (const err of [missing, wrong]) {
			expect(err).toBeInstanceOf(UnauthorizedError)
			expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })
		}
		expect(missing.message).toBe(wrong.message)
	})

	it('login com senha curta (não-vazia) → 401, não 400', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@techx.com',
			password: 'segredo12',
		})
		await expect(
			service.login({ email: 'ada@techx.com', password: 'x' }),
		).rejects.toMatchObject({
			statusCode: 401,
			code: 'UNAUTHORIZED',
		})
	})

	it('F7 register: senha curta / email inválido → 400 VALIDATION_ERROR', async () => {
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@techx.com',
				password: 'curta',
			}),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@techx.com',
				password: 'x'.repeat(129),
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
		for (const email of ['sem-arroba', 'a@', '@x.com', 'a@x', '']) {
			await expect(
				service.register({ name: 'Ada', email, password: 'segredo12' }),
			).rejects.toBeInstanceOf(ValidationError)
		}
	})

	it('F7 register: name vazio/whitespace/longo → 400', async () => {
		for (const name of ['', '   ', 'x'.repeat(121)]) {
			await expect(
				service.register({ name, email: 'a@techx.com', password: 'segredo12' }),
			).rejects.toMatchObject({
				code: 'VALIDATION_ERROR',
			})
		}
	})

	it('register faz trim no name', async () => {
		const user = await service.register({
			name: '  Ada  ',
			email: 'ada@techx.com',
			password: 'segredo12',
		})
		expect(user.name).toBe('Ada')
	})

	it('login com tipos errados → 400 (não 500)', async () => {
		await expect(
			service.login({ email: 123, password: 'segredo12' }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(
			service.login({ email: 'a@techx.com', password: '' }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('toPublicUser nunca expõe passwordHash', () => {
		const entity = Object.assign(new UserEntity(), {
			id: 1,
			name: 'Ada',
			email: 'ada@techx.com',
			passwordHash: 'hash:segredo12',
			createdAt: new Date(),
		})
		expect(toPublicUser(entity)).toEqual({
			id: 1,
			name: 'Ada',
			email: 'ada@techx.com',
			createdAt: entity.createdAt,
		})
		expect(toPublicUser(entity)).not.toHaveProperty('passwordHash')
	})
})
