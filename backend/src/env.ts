export interface AppEnv {
	nodeEnv: string
	host: string
	port: number
	corsOrigins?: string[]
	swaggerEnabled: boolean
	db: DbConfig
	dbTest: DbConfig
	auth: AuthConfig
	rateLimit: RateLimitConfig
	mongo: MongoConfig
}

export interface DbConfig {
	host: string
	port: number
	username: string
	password: string
	database: string
}

export interface AuthConfig {
	jwtSecret: string
	expiresIn: string
}

export interface RateLimitConfig {
	max: number
	windowMs: number
	allowlist: string[]
}

function required(name: string, value: string | undefined): string {
	if (value === undefined || value === '') {
		throw new Error(
			`[env] variável obrigatória ausente ou vazia: ${name} (ver backend/.env.example)`,
		)
	}
	return value
}

function numberVar(
	name: string,
	value: string | undefined,
	fallback?: number,
): number {
	const raw = value ?? (fallback !== undefined ? String(fallback) : undefined)
	const parsed = Number(raw)
	if (
		raw === undefined ||
		raw === '' ||
		!Number.isInteger(parsed) ||
		parsed <= 0
	) {
		throw new Error(
			`[env] variável ${name} deve ser um inteiro positivo (recebido: ${raw ?? 'ausente'})`,
		)
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
		database: required(
			p('DATABASE'),
			process.env[p('DATABASE')] ?? (prefix === '' ? 'todo_dev' : 'todo_test'),
		),
	}
}

export interface MongoConfig {
	url: string
	testUrl?: string
}

function mongoConfig(): MongoConfig {
	const testUrl = process.env.MONGO_TEST_URL
	return {
		url:
			process.env.MONGO_URL ??
			'mongodb://todo:todo@localhost:27017/todo_activity?authSource=admin',
		...(testUrl !== undefined && testUrl !== '' ? { testUrl } : {}),
	}
}

function corsOrigins(): string[] | undefined {
	const raw = process.env.CORS_ORIGINS
	if (raw === undefined || raw === '') return undefined
	const origins = raw
		.split(',')
		.map((o) => o.trim())
		.filter((o) => o !== '')
	return origins.length > 0 ? origins : undefined
}

function swaggerEnabled(nodeEnv: string): boolean {
	const raw = process.env.SWAGGER_ENABLED
	if (raw === undefined || raw === '') return nodeEnv !== 'production'
	if (raw === 'true') return true
	if (raw === 'false') return false
	throw new Error(
		`[env] variável SWAGGER_ENABLED deve ser "true" ou "false" (recebido: ${raw})`,
	)
}

function authConfig(nodeEnv: string): AuthConfig {
	const raw = process.env.JWT_SECRET
	if (raw === undefined || raw === '') {
		throw new Error(
			`[env] JWT_SECRET é obrigatória em QUALQUER ambiente (NODE_ENV=${nodeEnv}) — defina com 32+ caracteres (ver backend/.env.example)`,
		)
	}
	if (raw.length < 32) {
		throw new Error(
			'[env] variável JWT_SECRET deve ter ao menos 32 caracteres (ver backend/.env.example)',
		)
	}
	return { jwtSecret: raw, expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' }
}

function rateLimitConfig(nodeEnv: string): RateLimitConfig {
	const raw =
		process.env.RATE_LIMIT_ALLOWLIST ?? (nodeEnv === 'test' ? '127.0.0.1' : '')
	const allowlist = raw
		.split(',')
		.map((ip) => ip.trim())
		.filter((ip) => ip !== '')
	return {
		max: numberVar('RATE_LIMIT_MAX', process.env.RATE_LIMIT_MAX, 5),
		windowMs: numberVar(
			'RATE_LIMIT_WINDOW',
			process.env.RATE_LIMIT_WINDOW,
			60_000,
		),
		allowlist,
	}
}

export function loadEnv(): AppEnv {
	const nodeEnv = process.env.NODE_ENV ?? 'development'
	return {
		nodeEnv,
		host: process.env.APP_HOST ?? '0.0.0.0',
		port: numberVar('APP_PORT', process.env.APP_PORT, 3000),
		corsOrigins: corsOrigins(),
		swaggerEnabled: swaggerEnabled(nodeEnv),
		db: dbConfig(''),
		dbTest: dbConfig('TEST_'),
		auth: authConfig(nodeEnv),
		rateLimit: rateLimitConfig(nodeEnv),
		mongo: mongoConfig(),
	}
}

let cached: AppEnv | undefined
export const env: AppEnv = new Proxy({} as AppEnv, {
	get(_target, prop: keyof AppEnv) {
		cached ??= loadEnv()
		return cached[prop]
	},
})
