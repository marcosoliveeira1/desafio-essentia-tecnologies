import { ObjectId } from 'mongodb'
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm'

// T21: documento do histórico de atividades (extra Fase 6, coleção `task_activity`).
// Referencia taskId/userId SEM FK (por natureza do Mongo). Sem import de tasks/ aqui.
// F9: tipo explícito em TODA coluna — nada depende de inferência por decorator.
export type ActivityAction = 'created' | 'updated' | 'completed' | 'uncompleted' | 'deleted'

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
