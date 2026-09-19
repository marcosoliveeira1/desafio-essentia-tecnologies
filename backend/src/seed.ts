import bcrypt from 'bcryptjs'
import 'reflect-metadata'
import type { DataSource } from 'typeorm'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'
import { TypeOrmUserRepository } from './modules/auth/typeorm-user.repository.js'
import type { UserEntity } from './modules/auth/user.entity.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'

const DEMO_USER = {
	name: 'Demo',
	email: 'demo@essentia.com',
	password: 'demo1234',
}

const DEMO_TASKS: Array<{
	title: string
	description: string
	completed: boolean
}> = [
	{
		title: 'Conhecer o Essentia Todo List',
		description: 'Projeto demo do desafio Essentia',
		completed: true,
	},
	{
		title: 'Criar minha primeira tarefa',
		description: 'Use o formulário acima',
		completed: false,
	},
	{
		title: 'Marcar uma tarefa como concluída',
		description: 'Clique no checkbox ao lado do título',
		completed: false,
	},
	{
		title: 'Editar uma tarefa',
		description: 'Teste o botão de editar',
		completed: false,
	},
	{
		title: 'Filtrar pendentes e concluídas',
		description: 'Use os filtros da lista',
		completed: false,
	},
]

async function ensureDemoUser(db: DataSource): Promise<UserEntity> {
	const users = new TypeOrmUserRepository(db)
	const existing = await users.findByEmail(DEMO_USER.email)
	if (existing !== null) {
		return existing
	}
	const passwordHash = await bcrypt.hash(DEMO_USER.password, 10)
	try {
		return await users.create({
			name: DEMO_USER.name,
			email: DEMO_USER.email,
			passwordHash,
		})
	} catch {
		const raced = await users.findByEmail(DEMO_USER.email)
		if (raced === null) {
			throw new Error('[seed] usuário demo sumiu após conflito de criação')
		}
		return raced
	}
}

export async function runSeed(db: DataSource): Promise<void> {
	const demo = await ensureDemoUser(db)
	// eslint-disable-next-line no-console
	console.log(`[seed] usuário demo pronto: ${demo.email} (id=${demo.id})`)

	const backfilled = await db.query(
		'UPDATE tasks SET userId = ? WHERE userId IS NULL',
		[demo.id],
	)
	const affected = Array.isArray(backfilled)
		? 0
		: (backfilled?.affectedRows ?? 0)
	if (affected > 0) {
		// eslint-disable-next-line no-console
		console.log(`[seed] ${affected} tarefa(s) órfã(s) vinculada(s) ao demo`)
	}

	const repo = new TypeOrmTaskRepository(db)
	const existing = await repo.findAll()
	if (existing.length > 0) {
		// eslint-disable-next-line no-console
		console.log(`[seed] ${existing.length} tarefa(s) já existem — nada a fazer`)
		return
	}
	for (const demoTask of DEMO_TASKS) {
		const created = await repo.create(
			{ title: demoTask.title, description: demoTask.description },
			demo.id,
		)
		if (demoTask.completed) {
			await repo.update(created.id, { completed: true }, demo.id)
		}
	}
	// eslint-disable-next-line no-console
	console.log(
		`[seed] ${DEMO_TASKS.length} tarefas demo criadas (userId=${demo.id})`,
	)
}

async function main(): Promise<void> {
	const config = loadEnv()
	const db = createMysqlDataSource(config.db)
	await db.initialize()
	try {
		await runSeed(db)
		// eslint-disable-next-line no-console
		console.log(`[seed] banco: ${config.db.database}`)
	} finally {
		await db.destroy()
	}
}

const invokedDirectly =
	(process.argv[1] ?? '').replace(/\\/g, '/').endsWith('/seed.ts') ||
	(process.argv[1] ?? '').replace(/\\/g, '/').endsWith('/seed.js')
if (invokedDirectly) {
	void main().catch((err: unknown) => {
		// eslint-disable-next-line no-console
		console.error('[seed] falha:', err)
		process.exit(1)
	})
}
