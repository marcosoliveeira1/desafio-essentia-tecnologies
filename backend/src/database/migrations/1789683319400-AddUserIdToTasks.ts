import { type MigrationInterface, type QueryRunner, TableColumn, TableForeignKey } from 'typeorm'

// T16: adiciona `userId` nullable em `tasks` com FK p/ `users(id)`.
// Sem backfill: tarefas existentes ficam com userId NULL até T17/T18.
export class AddUserIdToTasks1789683319400 implements MigrationInterface {
  private readonly foreignKey = new TableForeignKey({
    name: 'FK_tasks_userId',
    columnNames: ['userId'],
    referencedTableName: 'users',
    referencedColumnNames: ['id'],
    onDelete: 'SET NULL',
  })

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'userId',
        type: 'int',
        isNullable: true,
      }),
    )
    await queryRunner.createForeignKey('tasks', this.foreignKey)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('tasks', 'FK_tasks_userId')
    await queryRunner.dropColumn('tasks', 'userId')
  }
}
