import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm'
import { TITLE_MAX } from '../../shared/constants/limits.js'

@Entity('tasks')
export class TaskEntity {
	@PrimaryGeneratedColumn('increment', { type: 'int' })
	id!: number

	@Column('varchar', { length: TITLE_MAX, nullable: false })
	title!: string

	@Column('text', { nullable: true })
	description!: string | null

	@Column('boolean', { nullable: false, default: false })
	completed!: boolean

	@Column('int', { nullable: false, default: 0 })
	position!: number

	@Column('int', { nullable: true })
	userId!: number | null

	@CreateDateColumn({ type: 'timestamp', nullable: false })
	createdAt!: Date

	@UpdateDateColumn({ type: 'timestamp', nullable: false })
	updatedAt!: Date
}
