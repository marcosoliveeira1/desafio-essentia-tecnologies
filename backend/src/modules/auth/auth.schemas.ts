import { type Static, Type } from '@sinclair/typebox'

const nameSchema = Type.String({
	minLength: 1,
	maxLength: 120,
	pattern: '^(?!\\s*$).+$',
	description: 'Nome do usuário (1..120 chars; whitespace-only rejeitado)',
})

const emailSchema = Type.String({
	minLength: 1,
	maxLength: 255,
	format: 'email',
	description: 'Email único (1..255 chars, formato válido)',
})

export const registerBodySchema = Type.Object(
	{
		name: nameSchema,
		email: emailSchema,
		password: Type.String({
			minLength: 8,
			maxLength: 128,
			description: 'Senha (8..128 chars)',
		}),
	},
	{ additionalProperties: false },
)

export const loginBodySchema = Type.Object(
	{
		email: emailSchema,
		password: Type.String({
			minLength: 1,
			description: 'Senha (não-vazia; curta cai em 401)',
		}),
	},
	{ additionalProperties: false },
)

export type RegisterBody = Static<typeof registerBodySchema>
export type LoginBody = Static<typeof loginBodySchema>
