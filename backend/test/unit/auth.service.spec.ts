import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	type AuthPorts,
	AuthService,
	type LoginInput,
	type RegisterInput,
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
	failNextCreateWith?: unknown

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
		if (this.failNextCreateWith !== undefined) {
			const toThrow = this.failNextCreateWith
			this.failNextCreateWith = undefined
			throw toThrow
		}
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
			email: 'Ada@Essentia.com ',
			password: 'segredo12',
		})
		expect(user.id).toBeGreaterThan(0)
		expect(user.name).toBe('Ada')
		expect(user.email).toBe('ada@essentia.com')
		expect(user.createdAt).toBeInstanceOf(Date)
		expect(user).not.toHaveProperty('passwordHash')

		const stored = await repo.findByEmail('ada@essentia.com')
		expect(stored?.passwordHash).toBe('hash:segredo12')
	})

	it('register com email duplicado (mesmo case diferente) → 409 EMAIL_CONFLICT', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@essentia.com',
			password: 'segredo12',
		})
		await expect(
			service.register({
				name: 'Outra',
				email: 'ADA@essentia.com',
				password: 'outra1234',
			}),
		).rejects.toMatchObject({
			statusCode: 409,
			code: 'EMAIL_CONFLICT',
			message: 'Email já cadastrado',
		})
		await expect(
			service.register({
				name: 'Outra',
				email: 'ada@essentia.com',
				password: 'outra1234',
			}),
		).rejects.toBeInstanceOf(ConflictError)
	})

	it('register converte apenas erros reais de UNIQUE (code ou errno) em 409', async () => {
		repo.failNextCreateWith = { code: 'ER_DUP_ENTRY' }
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({ code: 'EMAIL_CONFLICT' })
		repo.failNextCreateWith = { errno: 1062 }
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({ code: 'EMAIL_CONFLICT' })
	})

	it('register repropaga erros que não são de UNIQUE (incl. throw null)', async () => {
		repo.failNextCreateWith = new Error('boom')
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({ message: 'boom' })
		repo.failNextCreateWith = null
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			}),
		).rejects.toBeNull()
	})

	it('register converte ER_DUP_ENTRY (race no UNIQUE) em 409 EMAIL_CONFLICT', async () => {
		repo.failNextCreateAsDuplicate = true
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_CONFLICT' })
	})

	it('login ok retorna {token} com sub = userId', async () => {
		const created = await service.register({
			name: 'Ada',
			email: 'ada@essentia.com',
			password: 'segredo12',
		})
		const result = await service.login({
			email: ' ada@essentia.com',
			password: 'segredo12',
		})
		expect(result).toEqual({ token: `token-for-${created.id}` })
		expect(ports.signed).toEqual([{ sub: created.id }])
	})

	it('login com email inexistente e com senha errada dão o MESMO 401 genérico', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@essentia.com',
			password: 'segredo12',
		})
		const missing = await service
			.login({ email: 'ninguem@essentia.com', password: 'segredo12' })
			.catch((e) => e)
		const wrong = await service
			.login({ email: 'ada@essentia.com', password: 'errada123' })
			.catch((e) => e)
		for (const err of [missing, wrong]) {
			expect(err).toBeInstanceOf(UnauthorizedError)
			expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })
		}
		expect(missing.message).toBe(wrong.message)
	})

	it('login com email inexistente executa compare contra hash dummy (timing-safe) e mantém 401', async () => {
		const compare = vi.fn(async () => false)
		const spied = new AuthService(repo, { ...ports, compare })
		await expect(
			spied.login({ email: 'ninguem@essentia.com', password: 'segredo12' }),
		).rejects.toMatchObject({
			statusCode: 401,
			code: 'UNAUTHORIZED',
			message: 'Credenciais inválidas',
		})
		expect(compare).toHaveBeenCalledTimes(1)
		expect(compare).toHaveBeenCalledWith(
			'segredo12',
			expect.stringMatching(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/),
		)
		expect(ports.signed).toEqual([])
	})

	it('login com senha curta (não-vazia) → 401, não 400', async () => {
		await service.register({
			name: 'Ada',
			email: 'ada@essentia.com',
			password: 'segredo12',
		})
		await expect(
			service.login({ email: 'ada@essentia.com', password: 'x' }),
		).rejects.toMatchObject({
			statusCode: 401,
			code: 'UNAUTHORIZED',
		})
	})

	it('F7 register: senha curta / email inválido → 400 VALIDATION_ERROR', async () => {
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'curta',
			}),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
		await expect(
			service.register({
				name: 'Ada',
				email: 'ada@essentia.com',
				password: 'x'.repeat(129),
			}),
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
		for (const email of [
			'sem-arroba',
			'a@',
			'@x.com',
			'a@x',
			'',
			'a b@x.com',
			'a@x.com b',
		]) {
			await expect(
				service.register({ name: 'Ada', email, password: 'segredo12' }),
			).rejects.toBeInstanceOf(ValidationError)
		}
	})

	it('validação de email distingue obrigatório de inválido (mensagens exatas)', async () => {
		await expect(
			service.register({ name: 'Ada', email: '   ', password: 'segredo12' }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			details: [{ field: 'email', message: 'E-mail é obrigatório.' }],
		})
		await expect(
			service.register({
				name: 'Ada',
				email: 'sem-arroba',
				password: 'segredo12',
			}),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			details: [
				{
					field: 'email',
					message: 'E-mail inválido. Corrija e tente novamente.',
				},
			],
		})
	})

	it('register aceita limites exatos de tamanho (name 120, email 255, senha 8/128)', async () => {
		const noLimite = await service.register({
			name: 'n'.repeat(120),
			email: `${'l'.repeat(249)}@x.com`,
			password: 's'.repeat(128),
		})
		expect(noLimite.name).toHaveLength(120)
		expect(noLimite.email).toHaveLength(255)
		await expect(
			service.register({
				name: 'n',
				email: `${'l'.repeat(250)}@x.com`,
				password: 'segredo12',
			}),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.register({
				name: 'n',
				email: 'oito@x.com',
				password: 's'.repeat(8),
			}),
		).resolves.toMatchObject({ email: 'oito@x.com' })
	})

	it('register/login rejeitam payload não-objeto e campos de tipo errado (400)', async () => {
		await expect(
			service.register(undefined as unknown as RegisterInput),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.register({ name: 123, email: 'a@b.com', password: 'segredo12' }),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.register({
				name: 'Ada',
				email: 'a@b.com',
				password: 12345678,
			}),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.login(undefined as unknown as LoginInput),
		).rejects.toBeInstanceOf(ValidationError)
		await expect(
			service.login({ email: 'a@b.com', password: 123 }),
		).rejects.toBeInstanceOf(ValidationError)
	})

	it('F7 register: name vazio/whitespace/longo → 400', async () => {
		for (const name of ['', '   ', 'x'.repeat(121)]) {
			await expect(
				service.register({
					name,
					email: 'a@essentia.com',
					password: 'segredo12',
				}),
			).rejects.toMatchObject({
				code: 'VALIDATION_ERROR',
			})
		}
	})

	it('register faz trim no name', async () => {
		const user = await service.register({
			name: '  Ada  ',
			email: 'ada@essentia.com',
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
			service.login({ email: 'a@essentia.com', password: '' }),
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
		})
	})

	it('toPublicUser nunca expõe passwordHash', () => {
		const entity = Object.assign(new UserEntity(), {
			id: 1,
			name: 'Ada',
			email: 'ada@essentia.com',
			passwordHash: 'hash:segredo12',
			createdAt: new Date(),
		})
		expect(toPublicUser(entity)).toEqual({
			id: 1,
			name: 'Ada',
			email: 'ada@essentia.com',
			createdAt: entity.createdAt,
		})
		expect(toPublicUser(entity)).not.toHaveProperty('passwordHash')
	})
})
