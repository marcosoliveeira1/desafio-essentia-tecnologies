import type { ActivityAction, ActivityLogEntity } from './activity-log.entity.js'

// Entrada de domínio p/ registrar um evento (sem HTTP, sem driver).
export interface RecordActivityInput {
  taskId: number
  userId: number
  action: ActivityAction
  changes?: Record<string, { from: unknown; to: unknown }> | null
}

// PORTA (DIP): o TaskService (T22) depende só desta interface.
// Implementação: MongoActivityRepository (MongoDB via TypeORM).
export interface IActivityRepository {
  record(input: RecordActivityInput): Promise<ActivityLogEntity>
  findByTask(taskId: number, userId: number): Promise<ActivityLogEntity[]>
  findByUser(userId: number): Promise<ActivityLogEntity[]>
}
