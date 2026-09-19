import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm'

@Entity('tasks')
export class TaskEntity {
	@PrimaryGeneratedColumn('increment', { type: 'int' })
	id!: number

	@Column('varchar', { length: 255, nullable: false })
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
