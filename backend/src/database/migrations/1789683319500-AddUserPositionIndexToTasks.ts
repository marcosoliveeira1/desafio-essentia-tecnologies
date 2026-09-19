import { type MigrationInterface, type QueryRunner, TableIndex } from 'typeorm'

export class AddUserPositionIndexToTasks1789683319500
	implements MigrationInterface
{
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.createIndex(
			'tasks',
			new TableIndex({
				name: 'idx_tasks_user_position',
				columnNames: ['userId', 'position', 'id'],
			}),
		)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropIndex('tasks', 'idx_tasks_user_position')
	}
}
