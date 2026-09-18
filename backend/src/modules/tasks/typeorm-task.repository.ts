import type { DataSource, Repository } from 'typeorm'
import { TaskEntity } from './task.entity.js'
import type { CreateTaskInput, ITaskRepository, UpdateTaskInput } from './task.repository.js'

// ADAPTADOR MySQL da porta ITaskRepository — único lugar com SQL/TypeORM
// no módulo tasks (controller/service nunca tocam no banco direto).
export class TypeOrmTaskRepository implements ITaskRepository {
  private readonly orm: Repository<TaskEntity>

  constructor(db: DataSource) {
    this.orm = db.getRepository(TaskEntity)
  }

  findAll(): Promise<TaskEntity[]> {
    return this.orm.find({ order: { position: 'ASC', id: 'ASC' } })
  }

  findById(id: number): Promise<TaskEntity | null> {
    return this.orm.findOneBy({ id })
  }

  async create(data: CreateTaskInput): Promise<TaskEntity> {
    const task = this.orm.create({
      title: data.title,
      description: data.description ?? null,
      completed: false,
      position: data.position ?? 0,
    })
    return this.orm.save(task)
  }

  async update(id: number, data: UpdateTaskInput): Promise<TaskEntity | null> {
    const current = await this.findById(id)
    if (current === null) {
      return null
    }
    if (data.title !== undefined) {
      current.title = data.title
    }
    if (data.description !== undefined) {
      current.description = data.description
    }
    if (data.completed !== undefined) {
      current.completed = data.completed
    }
    if (data.position !== undefined) {
      current.position = data.position
    }
    return this.orm.save(current)
  }

  async getMaxPosition(): Promise<number> {
    const result = await this.orm
      .createQueryBuilder('task')
      .select('MAX(task.position)', 'max')
      .getRawOne<{ max: string | number | null }>()
    const max = result?.max === null || result?.max === undefined ? 0 : Number(result.max)
    return Number.isNaN(max) ? 0 : max
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.orm.delete(id)
    return (result.affected ?? 0) > 0
  }
}
