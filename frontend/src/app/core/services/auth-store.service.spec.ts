import { provideHttpClient } from '@angular/common/http'
import {
	HttpTestingController,
	provideHttpClientTesting,
} from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AuthStoreService } from './auth-store.service'
import { TokenService } from './token.service'

function fakeJwt(sub: number): string {
	const encode = (value: unknown): string =>
		btoa(JSON.stringify(value))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
	return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub })}.assinatura`
}

describe('AuthStoreService', () => {
	let store: AuthStoreService
	let httpMock: HttpTestingController
	let tokens: TokenService

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		})
		store = TestBed.inject(AuthStoreService)
		httpMock = TestBed.inject(HttpTestingController)
		tokens = TestBed.inject(TokenService)
		localStorage.clear()
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('login ok salva token e monta user do sub, authState authenticated', () => {
		const token = fakeJwt(42)

		store.login({ email: 'demo@techx.com', password: 'demo1234' })
		expect(store.loading()).toBe(true)

		const req = httpMock.expectOne('/api/auth/login')
		expect(req.request.method).toBe('POST')
		expect(req.request.body).toEqual({
			email: 'demo@techx.com',
			password: 'demo1234',
		})
		req.flush({ token })

		expect(tokens.getToken()).toBe(token)
		expect(store.user()).toEqual({
			email: 'demo@techx.com',
			id: 42,
			name: 'demo',
		})
		expect(store.authState()).toBe('authenticated')
		expect(store.error()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('login 401 → "Email ou senha inválidos.", sem token nem user', () => {
		store.login({ email: 'demo@techx.com', password: 'errada' })

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
			email: 'nova@techx.com',
			name: 'Nova',
			password: 'senha123',
		})

		const reg = httpMock.expectOne('/api/auth/register')
		expect(reg.request.method).toBe('POST')
		expect(reg.request.body).toEqual({
			email: 'nova@techx.com',
			name: 'Nova',
			password: 'senha123',
		})
		reg.flush({ email: 'nova@techx.com', id: 9, name: 'Nova' })

		const login = httpMock.expectOne('/api/auth/login')
		expect(login.request.method).toBe('POST')
		expect(login.request.body).toEqual({
			email: 'nova@techx.com',
			password: 'senha123',
		})
		login.flush({ token })

		expect(tokens.getToken()).toBe(token)
		expect(store.user()).toEqual({
			email: 'nova@techx.com',
			id: 9,
			name: 'Nova',
		})
		expect(store.authState()).toBe('authenticated')
		expect(store.error()).toBeNull()
		expect(store.loading()).toBe(false)
	})

	it('register 409 EMAIL_CONFLICT → "Email já cadastrado.", sem login', () => {
		store.register({
			email: 'demo@techx.com',
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
		store.register({ email: 'demo@techx.com', name: 'D', password: 'curta' })

		const reg = httpMock.expectOne('/api/auth/register')
		reg.flush(
			{ code: 'VALIDATION_ERROR', message: 'Dados inválidos' },
			{ status: 400, statusText: '' },
		)

		httpMock.expectNone('/api/auth/login')
		expect(store.error()).toBe('Verifique os dados e tente novamente.')
	})

	it('logout limpa token, user e erro', () => {
		const token = fakeJwt(42)
		store.login({ email: 'demo@techx.com', password: 'demo1234' })
		httpMock.expectOne('/api/auth/login').flush({ token })
		expect(store.authState()).toBe('authenticated')

		store.logout()

		expect(tokens.getToken()).toBeNull()
		expect(store.user()).toBeNull()
		expect(store.authState()).toBe('anonymous')
		expect(store.error()).toBeNull()
	})
})
