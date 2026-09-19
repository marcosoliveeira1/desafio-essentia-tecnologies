import { type Static, Type } from '@sinclair/typebox'
import { DESCRIPTION_MAX, TITLE_MAX } from '../../shared/constants/limits.js'

const titleSchema = Type.String({
	minLength: 1,
	maxLength: TITLE_MAX,
	pattern: '^(?!\\s*$).+$',
	description: `Título da tarefa (1..${TITLE_MAX} chars após trim; whitespace-only rejeitado)`,
	examples: ['Estudar Fastify'],
})

const descriptionSchema = Type.Union(
	[Type.String({ maxLength: DESCRIPTION_MAX }), Type.Null()],
	{
		description: `Descrição opcional (máx ${DESCRIPTION_MAX} chars)`,
		examples: ['Ler a documentação oficial do plugin'],
	},
)

export const createTaskBodySchema = Type.Object(
	{
		title: titleSchema,
		description: Type.Optional(descriptionSchema),
		completed: Type.Optional(
			Type.Boolean({
				description:
					'Preset da coluna de origem (true quando criada pelo + de Concluídas; omitido/false = A fazer)',
				examples: [true],
			}),
		),
	},
	{
		additionalProperties: false,
		description: 'Payload de criação de tarefa',
		examples: [
			{
				title: 'Estudar Fastify',
				description: 'Ler a documentação oficial do plugin',
			},
		],
	},
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
		description: 'Payload de atualização parcial (ao menos 1 campo)',
		examples: [{ completed: true }],
	},
)

export const taskParamsSchema = Type.Object(
	{
		id: Type.String({
			pattern: '^[1-9][0-9]*$',
			description: 'ID numérico da tarefa',
			examples: ['1'],
		}),
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
			description: 'IDs na nova ordem',
			examples: [[3, 1, 2]],
		}),
	},
	{
		additionalProperties: false,
		description: 'Reordenação das tarefas do usuário',
		examples: [{ ids: [3, 1, 2] }],
	},
)

export type ReorderTasksBody = Static<typeof reorderTasksBodySchema>
