import type { DataSource } from 'typeorm'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from 'vitest'
import { createMysqlDataSource } from '../../src/database/mysql.data-source.js'
import { env } from '../../src/env.js'
import { runSeed } from '../../src/seed.js'

const DEMO_EMAIL = 'demo@essentia.com'

interface CountRow {
	total: number
}

async function countRows(
	db: DataSource,
	table: 'tasks' | 'users',
): Promise<number> {
	const rows = (await db.query(
		`SELECT COUNT(*) AS total FROM ${table}`,
	)) as CountRow[]
	return Number(rows[0]?.total ?? 0)
}

describe('runSeed idempotency (e2e)', () => {
	let db: DataSource

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
	})

	afterAll(async () => {
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await db.query('DELETE FROM tasks')
		await db.query('DELETE FROM users')
	})

	it('2ª execução é no-op: sem erro, 1 usuário demo e tarefas estáveis', async () => {
		await expect(runSeed(db)).resolves.toBeUndefined()
		const tasksAfterFirst = await countRows(db, 'tasks')
		expect(tasksAfterFirst).toBeGreaterThan(0)

		await expect(runSeed(db)).resolves.toBeUndefined()

		const demoUsers = (await db.query(
			'SELECT id, email FROM users WHERE email = ?',
			[DEMO_EMAIL],
		)) as Array<{ id: number; email: string }>
		expect(demoUsers).toHaveLength(1)
		expect(demoUsers[0]?.email).toBe(DEMO_EMAIL)
		expect(await countRows(db, 'users')).toBe(1)

		const tasksAfterSecond = await countRows(db, 'tasks')
		expect(tasksAfterSecond).toBe(tasksAfterFirst)
	})
})

describe('runSeed production gate (e2e)', () => {
	let db: DataSource
	const previousNodeEnv = process.env.NODE_ENV

	beforeAll(async () => {
		db = createMysqlDataSource(env.dbTest)
		await db.initialize()
	})

	afterAll(async () => {
		if (db.isInitialized) {
			await db.destroy()
		}
	})

	beforeEach(async () => {
		await db.query('DELETE FROM tasks')
		await db.query('DELETE FROM users')
	})

	afterEach(() => {
		if (previousNodeEnv === undefined) {
			delete process.env.NODE_ENV
		} else {
			process.env.NODE_ENV = previousNodeEnv
		}
	})

	it('NODE_ENV=production não grava usuário nem tarefas demo', async () => {
		process.env.NODE_ENV = 'production'
		await expect(runSeed(db)).resolves.toBeUndefined()
		expect(await countRows(db, 'users')).toBe(0)
		expect(await countRows(db, 'tasks')).toBe(0)
	})

	it('gate restaurado: NODE_ENV fora de production volta a gravar demo', async () => {
		await expect(runSeed(db)).resolves.toBeUndefined()
		expect(await countRows(db, 'users')).toBe(1)
		expect(await countRows(db, 'tasks')).toBeGreaterThan(0)
	})
})
