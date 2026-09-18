import { Type, type Static } from '@sinclair/typebox'

// Schemas TypeBox: validação HTTP + tipos inferidos num lugar só.
// F7 (duas camadas): as MESMAS regras vivem aqui (400 na borda HTTP)
// e no AuthService (400 no domínio, p/ chamadas fora do HTTP).
// Cuidado: `format: 'email'` pode ser ignorado pelo Fastify sem
// ajv-formats — o service SEMPRE revalida com regex própria.

const nameSchema = Type.String({
  minLength: 1,
  maxLength: 120,
  // Rejeita string composta só de espaços (ex.: "   ").
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

// Login NÃO exige min 8: senha curta (mas não-vazia) é 401, não 400.
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
