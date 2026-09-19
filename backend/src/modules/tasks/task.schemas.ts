import { type Static, Type } from '@sinclair/typebox'

const titleSchema = Type.String({
	minLength: 1,
	maxLength: 255,
	pattern: '^(?!\\s*$).+$',
	description:
		'Título da tarefa (1..255 chars após trim; whitespace-only rejeitado)',
})

const descriptionSchema = Type.Union(
	[Type.String({ maxLength: 2000 }), Type.Null()],
	{
		description: 'Descrição opcional (máx 2000 chars)',
	},
)

export const createTaskBodySchema = Type.Object(
	{
		title: titleSchema,
		description: Type.Optional(descriptionSchema),
		completed: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false },
)

export const updateTaskBodySchema = Type.Object(
	{
		title: Type.Optional(titleSchema),
		description: Type.Optional(descriptionSchema),
		completed: Type.Optional(Type.Boolean()),
		position: Type.Optional(Type.Integer({ minimum: 0 })),
	},
	{
		minProperties: 1,
		additionalProperties: false,
	},
)

export const taskParamsSchema = Type.Object(
	{
		id: Type.String({ pattern: '^[1-9][0-9]*$' }),
	},
	{ additionalProperties: false },
)

export type CreateTaskBody = Static<typeof createTaskBodySchema>
export type UpdateTaskBody = Static<typeof updateTaskBodySchema>
export type TaskParams = Static<typeof taskParamsSchema>

export const reorderTasksBodySchema = Type.Object(
	{
		ids: Type.Array(Type.Integer({ minimum: 1 }), {
			minItems: 1,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
)

export type ReorderTasksBody = Static<typeof reorderTasksBodySchema>
