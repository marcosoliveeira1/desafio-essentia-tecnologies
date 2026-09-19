import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('users')
export class UserEntity {
	@PrimaryGeneratedColumn('increment', { type: 'int' })
	id!: number

	@Column('varchar', { length: 120, nullable: false })
	name!: string

	@Column('varchar', { length: 255, nullable: false, unique: true })
	email!: string

	@Column('varchar', { length: 255, nullable: false })
	passwordHash!: string

	@CreateDateColumn({ type: 'timestamp', nullable: false })
	createdAt!: Date
}
