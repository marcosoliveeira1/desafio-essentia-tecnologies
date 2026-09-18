import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

// F9: tipo explícito em TODA coluna — tsx/Vitest usam esbuild sem
// emitDecoratorMetadata, então nada pode depender de inferência por decorator.
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

  // T16: FK lógica p/ users(id) — coluna simples, sem ManyToOne eager.
  // Nullable até a Fase 5 (T18) escopar por usuário; ON DELETE SET NULL.
  @Column('int', { nullable: true })
  userId!: number | null

  @CreateDateColumn({ type: 'timestamp', nullable: false })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: false })
  updatedAt!: Date
}
