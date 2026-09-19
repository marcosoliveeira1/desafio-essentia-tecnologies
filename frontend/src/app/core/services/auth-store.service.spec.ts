import { provideHttpClient } from '@angular/common/http'
import {
	HttpTestingController,
	provideHttpClientTesting,
} from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AuthStoreService } from './auth-store.service'
import { TOKEN_STORAGE_KEY, TokenService } from './token.service'

function encodePayload(payload: unknown): string {
	return btoa(JSON.stringify(payload))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function fakeJwt(sub: number): string {
	return `${encodePayload({ alg: 'HS256', typ: 'JWT' })}.${encodePayload({ sub })}.assinatura`
}

function fakeSessionJwt(
	payload: Record<string, unknown> & { sub: number },
): string {
	return `${encodePayload({ alg: 'HS256', typ: 'JWT' })}.${encodePayload(payload)}.assinatura`
}

function injectStoreWithToken(token: string | null): AuthStoreService {
	localStorage.clear()
	if (token !== null) localStorage.setItem(TOKEN_STORAGE_KEY, token)
	TestBed.resetTestingModule()
	TestBed.configureTestingModule({
		providers: [provideHttpClient(), provideHttpClientTesting()],
	})
	return TestBed.inject(AuthStoreService)
}

describe('AuthStoreService', () => {
	let store: AuthStoreService
	let httpMock: HttpTestingController
	let tokens: TokenService

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		})
		localStorage.clear()
		store = TestBed.inject(AuthStoreService)
		httpMock = TestBed.inject(HttpTestingController)
		tokens = TestBed.inject(TokenService)
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('login ok salva token e monta user do sub, authState authenticated', () => {
		const token = fakeJwt(42)

		store.login({ email: 'demo@essentia.com', password: 'demo1234' })
		expect(store.loading()).toBe(true)

		const req = httpMock.expectOne('/api/auth/login')
		expect(req.request.method).toBe('POST')
		expect(req.request.body).toEqual({
			email: 'demo@essentia.com',
			password: 'demo1234',
		})
		req.flush({ token })

		expect(tokens.getToken()).toBe(token)
		expect(store.user()).toEqual({
			email: 'demo@essentia.com',
			id: 42,
			name: 'demo',
		})
		expect(store.authState()).toBe('authenticated')
		expect(store.error()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('login com sub:0 falha fechado: sem token, sem user, nunca id 0', () => {
		store.login({ email: 'demo@essentia.com', password: 'demo1234' })

		const req = httpMock.expectOne('/api/auth/login')
		req.flush({ token: fakeJwt(0) })

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.loading()).toBe(false)
		expect(store.error()).toBe('Não foi possível entrar. Tente novamente.')
	})

	it('login com token malformado falha fechado: sem token, sem user', () => {
		store.login({ email: 'demo@essentia.com', password: 'demo1234' })

		const req = httpMock.expectOne('/api/auth/login')
		req.flush({ token: 'nao-e-um-jwt' })

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.loading()).toBe(false)
		expect(store.error()).toBe('Não foi possível entrar. Tente novamente.')
	})
	it('login 401 → "Email ou senha inválidos.", sem token nem user', () => {
		store.login({ email: 'demo@essentia.com', password: 'errada' })

		const req = httpMock.expectOne('/api/auth/login')
		req.flush(
			{ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' },
			{ status: 401, statusText: '' },
		)

		expect(store.error()).toBe('Email ou senha inválidos.')
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(tokens.getToken()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('login 400 → "Verifique os dados e tente novamente."', () => {
		store.login({ email: 'invalido', password: 'x' })

		const req = httpMock.expectOne('/api/auth/login')
		req.flush(
			{ code: 'VALIDATION_ERROR', message: 'Dados inválidos' },
			{ status: 400, statusText: '' },
		)

		expect(store.error()).toBe('Verifique os dados e tente novamente.')
		expect(store.user()).toBeNull()
		expect(tokens.getToken()).toBeNull()
	})

	it('register faz POST register + auto-login encadeado', () => {
		const token = fakeJwt(9)

		store.register({
			email: 'nova@essentia.com',
			name: 'Nova',
			password: 'senha123',
		})

		const reg = httpMock.expectOne('/api/auth/register')
		expect(reg.request.method).toBe('POST')
		expect(reg.request.body).toEqual({
			email: 'nova@essentia.com',
			name: 'Nova',
			password: 'senha123',
		})
		reg.flush({ email: 'nova@essentia.com', id: 9, name: 'Nova' })

		const login = httpMock.expectOne('/api/auth/login')
		expect(login.request.method).toBe('POST')
		expect(login.request.body).toEqual({
			email: 'nova@essentia.com',
			password: 'senha123',
		})
		login.flush({ token })

		expect(tokens.getToken()).toBe(token)
		expect(store.user()).toEqual({
			email: 'nova@essentia.com',
			id: 9,
			name: 'Nova',
		})
		expect(store.authState()).toBe('authenticated')
		expect(store.error()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('register 409 EMAIL_CONFLICT → "Email já cadastrado.", sem login', () => {
		store.register({
			email: 'demo@essentia.com',
			name: 'Demo',
			password: 'demo1234',
		})

		const reg = httpMock.expectOne('/api/auth/register')
		reg.flush(
			{ code: 'EMAIL_CONFLICT', message: 'Email já cadastrado' },
			{ status: 409, statusText: '' },
		)

		httpMock.expectNone('/api/auth/login')
		expect(store.error()).toBe('Email já cadastrado.')
		expect(store.user()).toBeNull()
		expect(tokens.getToken()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('register 400 → "Verifique os dados e tente novamente."', () => {
		store.register({ email: 'demo@essentia.com', name: 'D', password: 'curta' })

		const reg = httpMock.expectOne('/api/auth/register')
		reg.flush(
			{ code: 'VALIDATION_ERROR', message: 'Dados inválidos' },
			{ status: 400, statusText: '' },
		)

		httpMock.expectNone('/api/auth/login')
		expect(store.error()).toBe('Verifique os dados e tente novamente.')
	})

	it('register com sub:0 falha fechado: sem token, sem user, nunca id 0', () => {
		store.register({
			email: 'nova@essentia.com',
			name: 'Nova',
			password: 'senha123',
		})

		const reg = httpMock.expectOne('/api/auth/register')
		reg.flush({ email: 'nova@essentia.com', id: 9, name: 'Nova' })

		const login = httpMock.expectOne('/api/auth/login')
		login.flush({ token: fakeJwt(0) })

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.loading()).toBe(false)
		expect(store.error()).toBe(
			'Não foi possível criar a conta. Tente novamente.',
		)
	})

	it('register com token malformado falha fechado: sem token, sem user', () => {
		store.register({
			email: 'nova@essentia.com',
			name: 'Nova',
			password: 'senha123',
		})

		const reg = httpMock.expectOne('/api/auth/register')
		reg.flush({ email: 'nova@essentia.com', id: 9, name: 'Nova' })

		const login = httpMock.expectOne('/api/auth/login')
		login.flush({ token: 'nao-e-um-jwt' })

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.loading()).toBe(false)
		expect(store.error()).toBe(
			'Não foi possível criar a conta. Tente novamente.',
		)
	})

	it('logout limpa token, user e erro', () => {
		const token = fakeJwt(42)
		store.login({ email: 'demo@essentia.com', password: 'demo1234' })
		httpMock.expectOne('/api/auth/login').flush({ token })
		expect(store.authState()).toBe('authenticated')

		store.logout()

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.error()).toBeNull()
	})
})

describe('AuthStoreService (hidratação no boot)', () => {
	let httpMock: HttpTestingController

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		})
		httpMock = TestBed.inject(HttpTestingController)
		localStorage.clear()
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('token válido no boot hidrata o user do payload (sub/name/email)', () => {
		const exp = Math.floor(Date.now() / 1000) + 3600
		const token = fakeSessionJwt({
			sub: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
			exp,
		})

		const store = injectStoreWithToken(token)

		expect(store.user()).toEqual({
			id: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
		})
		expect(store.authState()).toBe('authenticated')
		expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token)
	})

	it('token expirado no boot limpa o token e fica anônimo', () => {
		const exp = Math.floor(Date.now() / 1000) - 10
		const token = fakeSessionJwt({
			sub: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
			exp,
		})

		const store = injectStoreWithToken(token)

		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
	})

	it('token sem exp no boot é tratado como sessão inválida (logout local)', () => {
		const token = fakeSessionJwt({
			sub: 42,
			name: 'Ada',
			email: 'ada@essentia.com',
		})

		const store = injectStoreWithToken(token)

		expect(store.user()).toBeNull()
		expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
	})

	it('token malformado no boot limpa o token e fica anônimo', () => {
		const store = injectStoreWithToken('nao-e-um-jwt')

		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
	})

	it('token com sub:0 no boot fica anônimo e limpa o storage', () => {
		const exp = Math.floor(Date.now() / 1000) + 3600
		const token = fakeSessionJwt({
			sub: 0,
			name: 'Ada',
			email: 'ada@essentia.com',
			exp,
		})

		const store = injectStoreWithToken(token)

		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
	})

	it('sem token no boot o store inicia anônimo', () => {
		const store = injectStoreWithToken(null)

		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
	})
})
