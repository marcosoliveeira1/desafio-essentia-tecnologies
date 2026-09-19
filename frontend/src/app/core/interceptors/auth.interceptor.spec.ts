import {
	HttpClient,
	provideHttpClient,
	withInterceptors,
} from '@angular/common/http'
import {
	HttpTestingController,
	provideHttpClientTesting,
} from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { vi } from 'vitest'
import { TokenService } from '../services/token.service'
import { authInterceptor } from './auth.interceptor'

describe('authInterceptor', () => {
	let http: HttpClient
	let httpMock: HttpTestingController
	let tokens: TokenService
	let router: Router

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([authInterceptor])),
				provideHttpClientTesting(),
				provideRouter([]),
			],
		})
		http = TestBed.inject(HttpClient)
		httpMock = TestBed.inject(HttpTestingController)
		tokens = TestBed.inject(TokenService)
		router = TestBed.inject(Router)
		localStorage.clear()
		vi.restoreAllMocks()
	})

	afterEach(() => {
		httpMock.verify()
	})

	it('anexa Bearer quando há token', () => {
		tokens.setToken('jwt-abc')

		http.get('/api/tasks').subscribe()

		const req = httpMock.expectOne('/api/tasks')
		expect(req.request.method).toBe('GET')
		expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc')
		req.flush([])
	})

	it('não anexa Authorization quando não há token', () => {
		http.get('/api/tasks').subscribe()

		const req = httpMock.expectOne('/api/tasks')
		expect(req.request.headers.has('Authorization')).toBe(false)
		req.flush([])
	})

	it('não anexa Authorization em /api/auth/* mesmo com token', () => {
		tokens.setToken('jwt-abc')

		http
			.post('/api/auth/login', {
				email: 'demo@essentia.com',
				password: 'demo1234',
			})
			.subscribe()

		const req = httpMock.expectOne('/api/auth/login')
		expect(req.request.headers.has('Authorization')).toBe(false)
		req.flush({ token: 'novo' })
	})

	it('não anexa Authorization fora de /api', () => {
		tokens.setToken('jwt-abc')

		http.get('/assets/logo.svg').subscribe()

		const req = httpMock.expectOne('/assets/logo.svg')
		expect(req.request.headers.has('Authorization')).toBe(false)
		req.flush('')
	})

	it('não anexa Authorization em URL externa com /api/ no meio do path', () => {
		tokens.setToken('jwt-abc')

		http.get('https://cdn.example.com/assets/api/icons.svg').subscribe()

		const req = httpMock.expectOne(
			'https://cdn.example.com/assets/api/icons.svg',
		)
		expect(req.request.headers.has('Authorization')).toBe(false)
		req.flush('')
	})

	it('401 em rota protegida limpa o token e navega p/ /auth/login', () => {
		tokens.setToken('expirado')
		const navigateSpy = vi
			.spyOn(router, 'navigate')
			.mockResolvedValue(true as never)
		let seen = 0
		http.get('/api/tasks').subscribe({
			error: () => {
				seen += 1
			},
		})

		const req = httpMock.expectOne('/api/tasks')
		req.flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: '' })

		expect(seen).toBe(1)
		expect(tokens.getToken()).toBeNull()
		expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'])
	})

	it('401 em /api/auth/* NÃO limpa nem navega (sem loop no login)', () => {
		tokens.setToken('sessao-valida')
		const navigateSpy = vi
			.spyOn(router, 'navigate')
			.mockResolvedValue(true as never)
		let seen = 0
		http
			.post('/api/auth/login', {
				email: 'demo@essentia.com',
				password: 'errada',
			})
			.subscribe({
				error: () => {
					seen += 1
				},
			})

		const req = httpMock.expectOne('/api/auth/login')
		req.flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: '' })

		expect(seen).toBe(1)
		expect(tokens.getToken()).toBe('sessao-valida')
		expect(navigateSpy).not.toHaveBeenCalled()
	})

	it('erro não-401 em rota protegida propaga sem limpar nem navegar', () => {
		tokens.setToken('jwt-abc')
		const navigateSpy = vi
			.spyOn(router, 'navigate')
			.mockResolvedValue(true as never)

		http.get('/api/tasks').subscribe({ error: () => {} })

		const req = httpMock.expectOne('/api/tasks')
		req.flush({ code: 'INTERNAL_ERROR' }, { status: 500, statusText: '' })

		expect(tokens.getToken()).toBe('jwt-abc')
		expect(navigateSpy).not.toHaveBeenCalled()
	})
})
