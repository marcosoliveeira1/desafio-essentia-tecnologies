import 'reflect-metadata'
import { createMysqlDataSource } from './database/mysql.data-source.js'
import { loadEnv } from './env.js'
import { TypeOrmTaskRepository } from './modules/tasks/typeorm-task.repository.js'

// Seed opcional p/ dev (M4: avaliador vê a UI viva): `npm run seed`.
// Idempotente — só insere quando a tabela está vazia.
const DEMO_TASKS: Array<{ title: string; description: string; completed: boolean }> = [
  { title: 'Conhecer o Task Manager TechX', description: 'Projeto demo do desafio Essentia', completed: true },
  { title: 'Criar minha primeira tarefa', description: 'Use o formulário acima', completed: false },
  { title: 'Marcar uma tarefa como concluída', description: 'Clique no checkbox ao lado do título', completed: false },
  { title: 'Editar uma tarefa', description: 'Teste o botão de editar', completed: false },
  { title: 'Filtrar pendentes e concluídas', description: 'Use os filtros da lista', completed: false },
]

async function main(): Promise<void> {
  const config = loadEnv()
  const db = createMysqlDataSource(config.db)
  await db.initialize()
  try {
    const repo = new TypeOrmTaskRepository(db)
    const existing = await repo.findAll()
    if (existing.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[seed] ${existing.length} tarefa(s) já existem — nada a fazer`)
      return
    }
    for (const demo of DEMO_TASKS) {
      const created = await repo.create({ title: demo.title, description: demo.description })
      if (demo.completed) {
        await repo.update(created.id, { completed: true })
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[seed] ${DEMO_TASKS.length} tarefas demo criadas em ${config.db.database}`)
  } finally {
    await db.destroy()
  }
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[seed] falha:', err)
  process.exit(1)
})
