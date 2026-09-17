// Leitura/validação fail-fast das vars de `backend/.env.example`.
// NÃO renomear vars aqui sem atualizar o .env.example junto.

export interface AppEnv {
  nodeEnv: string
  host: string
  port: number
  db: DbConfig
  dbTest: DbConfig
}

export interface DbConfig {
  host: string
  port: number
  username: string
  password: string
  database: string
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`[env] variável obrigatória ausente ou vazia: ${name} (ver backend/.env.example)`)
  }
  return value
}

function numberVar(name: string, value: string | undefined, fallback?: number): number {
  const raw = value ?? (fallback !== undefined ? String(fallback) : undefined)
  const parsed = Number(raw)
  if (raw === undefined || raw === '' || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[env] variável ${name} deve ser um inteiro positivo (recebido: ${raw ?? 'ausente'})`)
  }
  return parsed
}

function dbConfig(prefix: '' | 'TEST_'): DbConfig {
  const p = (key: string) => (prefix === '' ? `DB_${key}` : `DB_TEST_${key}`)
  return {
    host: process.env[p('HOST')] ?? 'localhost',
    port: numberVar(p('PORT'), process.env[p('PORT')], 3306),
    username: required(p('USERNAME'), process.env[p('USERNAME')] ?? 'todo'),
    password: required(p('PASSWORD'), process.env[p('PASSWORD')] ?? 'todo'),
    database: required(p('DATABASE'), process.env[p('DATABASE')] ?? (prefix === '' ? 'todo_dev' : 'todo_test')),
  }
}

export function loadEnv(): AppEnv {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.APP_HOST ?? '0.0.0.0',
    port: numberVar('APP_PORT', process.env.APP_PORT, 3000),
    db: dbConfig(''),
    dbTest: dbConfig('TEST_'),
  }
}

// Config "preguiçosa" usada por testes e DataSource: só valida no acesso.
let cached: AppEnv | undefined
export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, prop: keyof AppEnv) {
    cached ??= loadEnv()
    return cached[prop]
  },
})
