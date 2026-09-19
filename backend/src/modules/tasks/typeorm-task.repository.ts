import type { DataSource, Repository } from 'typeorm'
import { In } from 'typeorm'
import { NotFoundError } from '../../shared/errors/not-found.error.js'
import { TaskEntity } from './task.entity.js'
import type {
	CreateTaskInput,
	ITaskRepository,
	UpdateTaskInput,
} from './task.repository.js'

export class TypeOrmTaskRepository implements ITaskRepository {
	private readonly orm: Repository<TaskEntity>
	private readonly db: DataSource

	constructor(db: DataSource) {
		this.db = db
		this.orm = db.getRepository(TaskEntity)
	}

	findAll(userId?: number): Promise<TaskEntity[]> {
		return this.orm.find({
			where: userId === undefined ? undefined : { userId },
			order: { position: 'ASC', id: 'ASC' },
		})
	}

	findById(id: number, userId?: number): Promise<TaskEntity | null> {
		return this.orm.findOneBy(userId === undefined ? { id } : { id, userId })
	}

	async create(data: CreateTaskInput, userId?: number): Promise<TaskEntity> {
		return this.db.transaction(async (manager) => {
			const repo = manager.getRepository(TaskEntity)
			const position = data.position ?? (await this.nextPosition(repo, userId))
			const task = repo.create({
				title: data.title,
				description: data.description ?? null,
				completed: data.completed ?? false,
				position,
				userId: userId ?? null,
			})
			return repo.save(task)
		})
	}

	private async currentMaxPosition(
		repo: Repository<TaskEntity>,
		userId?: number,
	): Promise<number> {
		const qb = repo
			.createQueryBuilder('task')
			.select('MAX(task.position)', 'max')
		if (userId !== undefined) {
			qb.where('task.userId = :userId', { userId })
		}
		const result = await qb.getRawOne<{ max: string | number | null }>()
		const max =
			result?.max === null || result?.max === undefined ? 0 : Number(result.max)
		return Number.isNaN(max) ? 0 : max
	}

	private async nextPosition(
		repo: Repository<TaskEntity>,
		userId?: number,
	): Promise<number> {
		return (await this.currentMaxPosition(repo, userId)) + 1
	}

	async update(
		id: number,
		data: UpdateTaskInput,
		userId?: number,
	): Promise<TaskEntity | null> {
		const where = userId === undefined ? { id } : { id, userId }
		if (Object.keys(data).length > 0) {
			await this.orm.update(where, data)
		}
		return this.orm.findOneBy(where)
	}

	async getMaxPosition(userId?: number): Promise<number> {
		return this.currentMaxPosition(this.orm, userId)
	}

	async delete(id: number, userId?: number): Promise<boolean> {
		const result = await this.orm.delete(
			userId === undefined ? id : { id, userId },
		)
		return (result.affected ?? 0) > 0
	}

	async updatePositions(
		orderedIds: number[],
		userId?: number,
	): Promise<TaskEntity[]> {
		if (orderedIds.length === 0) {
			return [] // serviço já valida vazio; defesa defensiva sem gastar query
		}
		return this.db.transaction(async (manager) => {
			const repo = manager.getRepository(TaskEntity)
			const scope = userId === undefined ? {} : { userId }

			// (1) posse: 1 SELECT id IN (…) — contagem para missingIds
			const owned = await repo.find({
				select: { id: true },
				where: { id: In(orderedIds), ...scope },
			})
			const ownedIds = new Set(owned.map((t) => t.id))
			const missingIds = orderedIds.filter((id) => !ownedIds.has(id))
			if (missingIds.length > 0) {
				throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', {
					missingIds,
				})
			}

			// (2) 1 UPDATE batch CASE WHEN — 100% parametrizado (placeholders ?)
			const cases = orderedIds.map(() => 'WHEN ? THEN ?').join(' ')
			const inPlaceholders = orderedIds.map(() => '?').join(', ')
			const setParams: number[] = []
			for (let index = 0; index < orderedIds.length; index++) {
				setParams.push(Number(orderedIds[index]), index)
			}
			const whereSql =
				userId === undefined
					? `WHERE \`id\` IN (${inPlaceholders})`
					: `WHERE \`userId\` = ? AND \`id\` IN (${inPlaceholders})`
			await manager.query(
				`UPDATE \`tasks\` SET \`position\` = CASE \`id\` ${cases} ELSE \`position\` END ${whereSql}`,
				[
					...setParams,
					...(userId === undefined ? [] : [userId]),
					...orderedIds,
				],
			)

			// (3) 1 SELECT de retorno; ordem do payload reconstruída em memória
			const rows = await repo.find({ where: { id: In(orderedIds), ...scope } })
			const byId = new Map(rows.map((t) => [t.id, t]))
			return orderedIds.map((id) => byId.get(id) as TaskEntity)
		})
	}
}
