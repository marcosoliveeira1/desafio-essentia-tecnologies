export type ActivityAction =
	| 'created'
	| 'updated'
	| 'completed'
	| 'uncompleted'
	| 'deleted'

export interface ActivityEntry {
	id: string
	taskId: number
	userId: number
	action: ActivityAction
	changes: Record<string, { from: unknown; to: unknown }> | null
	occurredAt: string
}
