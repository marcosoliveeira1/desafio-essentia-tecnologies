import { type MigrationInterface, type QueryRunner, Table } from 'typeorm'

// T16: cria a tabela `users` (base do auth — Fase 5).
export class CreateUsersTable1789683319300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isNullable: false,
          },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'email', type: 'varchar', length: '255', isNullable: false, isUnique: true },
          { name: 'passwordHash', type: 'varchar', length: '255', isNullable: false },
          { name: 'createdAt', type: 'timestamp', isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users', true)
  }
}
