import { type Static, Type } from '@sinclair/typebox'

const nameSchema = Type.String({
	minLength: 1,
	maxLength: 120,
	pattern: '^(?!\\s*$).+$',
	description: 'Nome do usuário (1..120 chars; whitespace-only rejeitado)',
	examples: ['Ada Lovelace'],
})

const emailSchema = Type.String({
	minLength: 1,
	maxLength: 255,
	format: 'email',
	description: 'Email único (1..255 chars, formato válido)',
	examples: ['ada@essentia.com'],
})

export const registerBodySchema = Type.Object(
	{
		name: nameSchema,
		email: emailSchema,
		password: Type.String({
			minLength: 8,
			maxLength: 72,
			description: 'Senha (8..72 chars; bcrypt trunca em 72 bytes)',
			examples: ['segredo12'],
		}),
	},
	{
		additionalProperties: false,
		description: 'Payload de registro de usuário',
		examples: [
			{
				name: 'Ada Lovelace',
				email: 'ada@essentia.com',
				password: 'segredo12',
			},
		],
	},
)

export const loginBodySchema = Type.Object(
	{
		email: emailSchema,
		password: Type.String({
			minLength: 1,
			description: 'Senha (não-vazia; curta cai em 401)',
			examples: ['segredo12'],
		}),
	},
	{
		additionalProperties: false,
		description: 'Payload de login',
		examples: [{ email: 'demo@essentia.com', password: 'segredo12' }],
	},
)

export type RegisterBody = Static<typeof registerBodySchema>
export type LoginBody = Static<typeof loginBodySchema>
