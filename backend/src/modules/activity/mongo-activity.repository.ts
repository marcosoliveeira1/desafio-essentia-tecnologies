import type { DataSource } from 'typeorm'
import { ActivityLogEntity } from './activity-log.entity.js'
import type { IActivityRepository, RecordActivityInput } from './activity.repository.js'

// ADAPTADOR (DIP): isola a API do driver Mongo do TypeORM (`getMongoRepository`)
// atrás da porta `IActivityRepository`. Leituras em ordem cronológica desc.
export class MongoActivityRepository implements IActivityRepository {
  constructor(private readonly mongo: DataSource) {}

  async record(input: RecordActivityInput): Promise<ActivityLogEntity> {
    const repo = this.mongo.getMongoRepository(ActivityLogEntity)
    const doc = repo.create({
      taskId: input.taskId,
      userId: input.userId,
      action: input.action,
      changes: input.changes ?? null,
    })
    return repo.save(doc)
  }

  async findByTask(taskId: number, userId: number): Promise<ActivityLogEntity[]> {
    return this.mongo
      .getMongoRepository(ActivityLogEntity)
      .find({ where: { taskId, userId }, order: { occurredAt: 'DESC' } })
  }

  async findByUser(userId: number): Promise<ActivityLogEntity[]> {
    return this.mongo
      .getMongoRepository(ActivityLogEntity)
      .find({ where: { userId }, order: { occurredAt: 'DESC' } })
  }
}
