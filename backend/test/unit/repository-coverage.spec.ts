import type { ObjectId } from 'mongodb'
import type { DataSource } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { ActivityLogEntity } from '../../src/modules/activity/activity-log.entity.js'
import { MongoActivityRepository } from '../../src/modules/activity/mongo-activity.repository.js'
import { TypeOrmUserRepository } from '../../src/modules/auth/typeorm-user.repository.js'
import { UserEntity } from '../../src/modules/auth/user.entity.js'

function userDb(orm: Record<string, unknown>): DataSource {
	return { getRepository: () => orm } as unknown as DataSource
}

describe('TypeOrmUserRepository (unit, DataSource fake)', () => {
	it('findByEmail delega com {email}', async () => {
		const found = Object.assign(new UserEntity(), { id: 1 })
		const findOneBy = vi.fn(async () => found)
		const repo = new TypeOrmUserRepository(userDb({ findOneBy }))
		await expect(repo.findByEmail('ada@essentia.com')).resolves.toBe(found)
		expect(findOneBy).toHaveBeenCalledWith({ email: 'ada@essentia.com' })
	})

	it('findById delega com {id}', async () => {
		const findOneBy = vi.fn(async () => null)
		const repo = new TypeOrmUserRepository(userDb({ findOneBy }))
		await expect(repo.findById(42)).resolves.toBeNull()
		expect(findOneBy).toHaveBeenCalledWith({ id: 42 })
	})

	it('create monta entidade e salva', async () => {
		const created = { id: 7 }
		const create = vi.fn((input: unknown) => input)
		const save = vi.fn(async (entity: unknown) => ({
			...(entity as Record<string, unknown>),
			...created,
		}))
		const repo = new TypeOrmUserRepository(userDb({ create, save }))
		const result = await repo.create({
			name: 'Ada',
			email: 'ada@essentia.com',
			passwordHash: 'hash:x',
		})
		expect(create).toHaveBeenCalledWith({
			name: 'Ada',
			email: 'ada@essentia.com',
			passwordHash: 'hash:x',
		})
		expect(save).toHaveBeenCalled()
		expect(result).toMatchObject({ id: 7, email: 'ada@essentia.com' })
	})
})

function activityDb(mongoRepo: Record<string, unknown>): DataSource {
	return { getMongoRepository: () => mongoRepo } as unknown as DataSource
}

function log(partial: Partial<ActivityLogEntity>): ActivityLogEntity {
	return {
		id: 'some-id' as unknown as ObjectId,
		taskId: 1,
		userId: 1,
		action: 'created',
		changes: null,
		occurredAt: new Date('2026-01-01T00:00:00.000Z'),
		...partial,
	} as ActivityLogEntity
}

describe('MongoActivityRepository (unit, mongo fake)', () => {
	it('record persiste changes informados', async () => {
		const create = vi.fn((doc: unknown) => doc)
		const save = vi.fn(async (doc: unknown) => ({
			...(doc as Record<string, unknown>),
			id: 'novo-id',
		}))
		const repo = new MongoActivityRepository(
			activityDb({ create, save, find: async () => [] }),
		)
		const changes = { title: { from: 'A', to: 'B' } }
		const result = await repo.record({
			taskId: 3,
			userId: 4,
			action: 'updated',
			changes,
		})
		expect(create).toHaveBeenCalledWith({
			taskId: 3,
			userId: 4,
			action: 'updated',
			changes,
		})
		expect(result).toMatchObject({ id: 'novo-id' })
	})

	it('record sem changes grava null', async () => {
		const create = vi.fn((doc: unknown) => doc)
		const save = vi.fn(async (doc: unknown) => doc)
		const repo = new MongoActivityRepository(
			activityDb({ create, save, find: async () => [] }),
		)
		await repo.record({ taskId: 1, userId: 1, action: 'created' })
		expect(create).toHaveBeenCalledWith({
			taskId: 1,
			userId: 1,
			action: 'created',
			changes: null,
		})
	})

	it('findByTask filtra por task+user e ordena por occurredAt desc', async () => {
		const older = log({ id: 'a' as unknown as ObjectId })
		const newer = log({
			id: 'b' as unknown as ObjectId,
			occurredAt: new Date('2026-06-01T00:00:00.000Z'),
		})
		const find = vi.fn(async () => [older, newer])
		const repo = new MongoActivityRepository(activityDb({ find }))
		const result = await repo.findByTask(1, 1)
		expect(find).toHaveBeenCalledWith({
			where: { taskId: 1, userId: 1 },
			order: { occurredAt: 'DESC' },
		})
		expect(result.map((l) => l.id)).toEqual(['b', 'a'])
	})

	it('findByUser filtra por user; empate de data desempata por id', async () => {
		const same = new Date('2026-03-01T00:00:00.000Z')
		const first = log({ id: 'a-id' as unknown as ObjectId, occurredAt: same })
		const second = log({ id: 'z-id' as unknown as ObjectId, occurredAt: same })
		const find = vi.fn(async () => [first, second])
		const repo = new MongoActivityRepository(activityDb({ find }))
		const result = await repo.findByUser(9)
		expect(find).toHaveBeenCalledWith({
			where: { userId: 9 },
			order: { occurredAt: 'DESC' },
		})
		expect(result.map((l) => l.id)).toEqual(['z-id', 'a-id'])
	})

	it('ActivityLogEntity é importável como entidade', () => {
		expect(new ActivityLogEntity()).toBeInstanceOf(ActivityLogEntity)
	})
})
