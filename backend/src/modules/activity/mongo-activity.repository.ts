import type { DataSource } from 'typeorm'
import type {
	IActivityRepository,
	RecordActivityInput,
} from './activity.repository.js'
import { ActivityLogEntity } from './activity-log.entity.js'

function byOccurredDesc(a: ActivityLogEntity, b: ActivityLogEntity): number {
	const dt = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
	if (dt !== 0) {
		return dt
	}
	return String(b.id).localeCompare(String(a.id))
}

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

	async findByTask(
		taskId: number,
		userId: number,
	): Promise<ActivityLogEntity[]> {
		const logs = await this.mongo
			.getMongoRepository(ActivityLogEntity)
			.find({ where: { taskId, userId }, order: { occurredAt: 'DESC' } })
		return logs.sort(byOccurredDesc)
	}

	async findByUser(userId: number): Promise<ActivityLogEntity[]> {
		const logs = await this.mongo
			.getMongoRepository(ActivityLogEntity)
			.find({ where: { userId }, order: { occurredAt: 'DESC' } })
		return logs.sort(byOccurredDesc)
	}
}
