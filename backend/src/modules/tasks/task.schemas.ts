import { Type, type Static } from '@sinclair/typebox'

// Schemas TypeBox: validação + tipos inferidos num lugar só.
// F3: title com `trim` no service + rejeição de whitespace-only AQUI (pattern)
// e no service (pós-trim) — defesa em duas camadas (HTTP e domínio).

const titleSchema = Type.String({
  minLength: 1,
  maxLength: 255,
  // Rejeita string composta só de espaços (ex.: "   ").
  // Títulos com espaço nas bordas ("  x  ") passam aqui e o service faz trim.
  pattern: '^(?!\\s*$).+$',
  description: 'Título da tarefa (1..255 chars após trim; whitespace-only rejeitado)',
})

const descriptionSchema = Type.Union([Type.String({ maxLength: 2000 }), Type.Null()], {
  description: 'Descrição opcional (máx 2000 chars)',
})

export const createTaskBodySchema = Type.Object(
  {
    title: titleSchema,
    description: Type.Optional(descriptionSchema),
    // Aceito mas ignorado: `completed` sempre nasce false (regra no service).
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
    // PATCH vazio → 400 direto na validação HTTP (o service também barra).
    minProperties: 1,
    additionalProperties: false,
  },
)

// Params chegam como string no HTTP (sem coercion do Ajv padrão do Fastify,
// um Type.Integer rejeitaria até ids válidos). Pattern numérico + conversão
// p/ Number no controller — "abc" cai em 400, "999" vira 999.
export const taskParamsSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[1-9][0-9]*$' }),
  },
  { additionalProperties: false },
)

export type CreateTaskBody = Static<typeof createTaskBodySchema>
export type UpdateTaskBody = Static<typeof updateTaskBodySchema>
export type TaskParams = Static<typeof taskParamsSchema>

// R1: reorder — body {ids: int[]} com minItems 1, uniqueItems, minimum 1.
export const reorderTasksBodySchema = Type.Object(
  {
    ids: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1, uniqueItems: true }),
  },
  { additionalProperties: false },
)

export type ReorderTasksBody = Static<typeof reorderTasksBodySchema>
