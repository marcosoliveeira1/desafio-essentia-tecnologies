import type { DataSource, Repository } from 'typeorm'
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
				completed: false,
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
		return this.db.transaction(async (manager) => {
			const repo = manager.getRepository(TaskEntity)
			for (let index = 0; index < orderedIds.length; index++) {
				const result = await repo.update(
					userId === undefined
						? { id: orderedIds[index] }
						: { id: orderedIds[index], userId },
					{ position: index },
				)
				if ((result.affected ?? 0) === 0) {
					throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', {
						missingIds: [orderedIds[index]],
					})
				}
			}
			const result: TaskEntity[] = []
			for (const id of orderedIds) {
				const task = await repo.findOneBy(
					userId === undefined ? { id } : { id, userId },
				)
				if (task === null) {
					throw new NotFoundError('Tarefa não encontrada', 'TASK_NOT_FOUND', {
						missingIds: [id],
					})
				}
				result.push(task)
			}
			return result
		})
	}
}
