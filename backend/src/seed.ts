import bcrypt from 'bcryptjs'
import 'reflect-metadata'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'
import { TypeOrmUserRepository } from './modules/auth/typeorm-user.repository.js'
import { UserEntity } from './modules/auth/user.entity.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'
import type { DataSource } from 'typeorm'

// Seed opcional p/ dev (M4: avaliador vê a UI viva): `npm run seed`.
// Idempotente — segunda execução não duplica nada.
// T17: cria o usuário demo (Demo / demo@techx.com / demo1234, bcrypt)
// e vincula as tarefas demo ao userId dele (backfill das órfãs).
const DEMO_USER = { name: 'Demo', email: 'demo@techx.com', password: 'demo1234' }

const DEMO_TASKS: Array<{ title: string; description: string; completed: boolean }> = [
  { title: 'Conhecer o Task Manager TechX', description: 'Projeto demo do desafio Essentia', completed: true },
  { title: 'Criar minha primeira tarefa', description: 'Use o formulário acima', completed: false },
  { title: 'Marcar uma tarefa como concluída', description: 'Clique no checkbox ao lado do título', completed: false },
  { title: 'Editar uma tarefa', description: 'Teste o botão de editar', completed: false },
  { title: 'Filtrar pendentes e concluídas', description: 'Use os filtros da lista', completed: false },
]

async function ensureDemoUser(db: DataSource): Promise<UserEntity> {
  const users = new TypeOrmUserRepository(db)
  const existing = await users.findByEmail(DEMO_USER.email)
  if (existing !== null) {
    return existing
  }
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 10)
  try {
    return await users.create({ name: DEMO_USER.name, email: DEMO_USER.email, passwordHash })
  } catch {
    // Corrida (seed duplo simultâneo): o UNIQUE barra o segundo — relê.
    const raced = await users.findByEmail(DEMO_USER.email)
    if (raced === null) {
      throw new Error('[seed] usuário demo sumiu após conflito de criação')
    }
    return raced
  }
}

// Roda no boot do app (main.ts) e no CLI `npm run seed` — idempotente.
export async function runSeed(db: DataSource): Promise<void> {
  const demo = await ensureDemoUser(db)
  // eslint-disable-next-line no-console
  console.log(`[seed] usuário demo pronto: ${demo.email} (id=${demo.id})`)

  // Backfill: tarefas órfãs (criadas antes da Fase 5) pertencem ao demo.
  const backfilled = await db.query('UPDATE tasks SET userId = ? WHERE userId IS NULL', [demo.id])
  const affected = Array.isArray(backfilled) ? 0 : (backfilled?.affectedRows ?? 0)
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
    // T18: create já persiste userId (escopo por usuário).
    const created = await repo.create({ title: demoTask.title, description: demoTask.description }, demo.id)
    if (demoTask.completed) {
      await repo.update(created.id, { completed: true }, demo.id)
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] ${DEMO_TASKS.length} tarefas demo criadas (userId=${demo.id})`)
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

// Só executa o CLI quando chamado direto (`npm run seed`); importado
// pelo main.ts (seed no boot), exporta apenas runSeed sem efeito colateral.
const invokedDirectly = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('/seed.ts') || (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('/seed.js')
if (invokedDirectly) {
  void main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[seed] falha:', err)
    process.exit(1)
  })
}
