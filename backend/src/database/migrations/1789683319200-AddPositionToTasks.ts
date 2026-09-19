import { type MigrationInterface, type QueryRunner, TableColumn } from 'typeorm'

export class AddPositionToTasks1789683319200 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumn(
			'tasks',
			new TableColumn({
				name: 'position',
				type: 'int',
				isNullable: false,
				default: 0,
			}),
		)
		await queryRunner.query('UPDATE `tasks` SET `position` = `id`')
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropColumn('tasks', 'position')
	}
}
