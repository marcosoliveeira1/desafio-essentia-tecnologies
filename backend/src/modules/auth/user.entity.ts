import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

// F9: tipo explícito em TODA coluna — tsx/Vitest usam esbuild sem
// emitDecoratorMetadata, então nada pode depender de inferência por decorator.
// Sem updatedAt (T16): usuário não precisa de trilha de atualização.
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
