import type { ObjectId } from 'mongodb'
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm'

export type ActivityAction =
	| 'created'
	| 'updated'
	| 'completed'
	| 'uncompleted'
	| 'deleted'

@Entity('task_activity')
export class ActivityLogEntity {
	@ObjectIdColumn()
	id!: ObjectId

	@Column('int', { nullable: false })
	taskId!: number

	@Column('int', { nullable: false })
	userId!: number

	@Column('varchar', { length: 20, nullable: false })
	action!: ActivityAction

	@Column('json', { nullable: true })
	changes!: Record<string, { from: unknown; to: unknown }> | null

	@CreateDateColumn({ type: 'timestamp', nullable: false })
	occurredAt!: Date
}
